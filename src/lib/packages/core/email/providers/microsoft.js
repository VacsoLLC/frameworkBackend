import EmailProvider from './emailprovider.js';

import * as graph from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import * as msal from '@azure/msal-node';
import { ClientSecretCredential } from '@azure/identity';

import { convert } from 'html-to-text';

export default class Microsoft extends EmailProvider {
  constructor(config) {
    super(config);
  }

  async init() {
    const result = await this.setupClient();

    if (result && !this.noBackgroundTasks) {
      setInterval(() => {
        console.log(`Checking email for ${this.config.name}...`);
        this.checkEmail();
      }, this.config.checkInterval);
    }
  }

  async archiveEmail(id) {
    await this.client
      .api(`/users/${this.config.email}/messages/${id}/move`)
      .header('Prefer', 'IdType="ImmutableId"')
      .post({ destinationId: 'archive' });
  }

  async checkEmail() {
    try {
      let messages = await this.client
        .api(`/users/${this.config.email}/mailFolders/Inbox/messages`)
        //.select('sender,subject')
        .header('Prefer', 'IdType="ImmutableId"')
        .top(500)
        .get();

      for (const email of messages.value) {
        let body = '';
        if (email.body.contentType === 'html') {
          body = convert(email.body.content, { wordwrap: 130 });
        } else if (email.body.contentType === 'text') {
          body = email.body.content;
        } else {
          body = email.body.content;
        }

        const processed = await this.callBack({
          from: email.from.emailAddress.address,
          subject: email.subject,
          body,
          emailConversationId: email.conversationId,
          emailId: email.id,
          emailProvider: this.config.name,
          assignmentGroup: this.config.assignmentGroup,
        });

        if (processed) {
          await this.archiveEmail(email.id);
        }
      }
    } catch (error) {
      console.log('error checking email', error, this.config);
    }
  }

  async sendEmail(args) {
    // Construct email object
    const mail = {
      subject: args.subject,
      toRecipients: [
        {
          emailAddress: {
            address: args.to,
          },
        },
      ],
      body: {
        content: args.body,
        contentType: 'text',
      },
    };

    try {
      if (args.emailId) {
        let response = await this.client
          .api(`/users/${this.config.email}/messages/${args.emailId}/reply`)
          .header('Prefer', 'IdType="ImmutableId"')
          .post({ message: mail });
        console.log('email sent!', response);
      } else {
        let draftResponse = await this.client
          .api(`/users/${this.config.email}/messages`)
          .header('Prefer', 'IdType="ImmutableId"')
          .post(mail);

        console.log('email sent!', draftResponse);

        let response2 = await this.client
          .api(`/users/${this.config.email}/messages/${draftResponse.id}/send`)
          .header('Prefer', 'IdType="ImmutableId"')
          .post();

        return {
          emailId: draftResponse.id,
          emailConversationId: draftResponse.conversationId,
        };
      }
    } catch (error) {
      console.log('email send error!');
      throw error;
    }
  }

  async setupClient() {
    if (
      !this.config.auth ||
      !this.config.auth.clientId ||
      !this.config.auth.clientSecret ||
      !this.config.auth.tenantId
    ) {
      console.log(
        'Microsoft email client not configured correctly. Missing values in auth object. (clientId, clientSecret, tenantId)'
      );
      return false;
    }

    try {
      const credential = new ClientSecretCredential(
        this.config.auth.tenantId,
        this.config.auth.clientId,
        this.config.auth.clientSecret
      );

      const authProvider = new TokenCredentialAuthenticationProvider(
        credential,
        {
          scopes: ['https://graph.microsoft.com/.default'],
        }
      );

      this.client = graph.Client.initWithMiddleware({
        authProvider,
        //debugLogging: true,
      });
      return true;
    } catch (error) {
      console.log('Error setting up Microsoft email client', error);
      return false;
    }
  }
}
