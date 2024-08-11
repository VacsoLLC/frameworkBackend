import EmailProvider from './emailprovider.js';
import { google } from 'googleapis';
import PostalMime from 'postal-mime';
import { createMimeMessage } from 'mimetext';

export default class Google extends EmailProvider {
  constructor(config) {
    super(config);

    if (
      !this.config.auth ||
      !this.config.auth.client_email ||
      !this.config.auth.private_key ||
      !this.config.email
    ) {
      console.log(
        'Missing required config values for Google email provider. (auth.client_email, auth.private_key, email)'
      );
      return;
    }

    const client = new google.auth.JWT(
      this.config.auth.client_email,
      null,
      this.config.auth.private_key,
      [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      this.config.email // The user email to impersonate
    );

    this.gmail = google.gmail({ version: 'v1', auth: client });
  }

  async init() {
    if (!this.gmail) {
      return;
    }

    setInterval(() => {
      console.log(`Checking email for ${this.config.name}...`);
      this.checkMessages();
    }, this.config.checkInterval);
  }

  async checkMessages() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: this.config.email, // The user email to access
        //q: 'is:unread',
        q: 'in:Inbox',
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        return;
      }

      for (const message of response.data.messages) {
        const messageResponse = await this.gmail.users.messages.get({
          userId: this.config.email,
          id: message.id,
          format: 'raw',
        });

        messageResponse.data.raw = messageResponse.data.raw
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        messageResponse.data.raw = Buffer.from(
          messageResponse.data.raw,
          'base64'
        ).toString('utf8');

        const parser = new PostalMime();

        const email = await parser.parse(messageResponse.data.raw);

        const processed = await this.callBack({
          from: email.from.address,
          subject: email.subject,
          body: email.text,
          emailConversationId: messageResponse.data.threadId,
          emailId: email.messageId,
          emailProvider: this.config.name,
          assignmentGroup: this.config.assignmentGroup,
        });

        if (processed) {
          await this.markEmailProcessed(message.id);
        }
      }
    } catch (error) {
      console.log('error checking email', error, this.config);
    }
  }

  async markEmailProcessed(emailId) {
    try {
      await this.gmail.users.messages.modify({
        userId: this.config.email,
        id: emailId,
        requestBody: {
          removeLabelIds: ['INBOX'], // Remove the message from the inbox
        },
      });
    } catch (error) {
      console.log('error marking email processed', error, this.config);
    }
  }

  async sendEmail(args) {
    console.log('Sending email', args);

    if (!this.config.email) {
      throw new Error('No email address configured for this email provider');
    }

    const message = createMimeMessage();

    message.setSender(this.config.email);
    message.setTo(args.to);
    message.setSubject(args.subject);
    message.addMessage({
      contentType: 'text/plain',
      data: args.body,
    });

    if (args.emailId) {
      message.setHeader('In-Reply-To', args.emailId);
      message.setHeader('References', args.emailId);
    }

    const result = await this.gmail.users.messages.send({
      userId: this.config.email,

      requestBody: {
        threadId: args.emailConversationId,
        raw: message.asEncoded(),
      },
    });
    console.log('Email sent!', result);

    if (!args.emailId) {
      // If this is a new email, we need to update the conversationId and emailId
      const email = await this.getMessage(result.data.id);

      return {
        emailId: email.rawParsed.messageId,
        emailConversationId: email.data.threadId,
      };
    }
  }

  async getMessage(id) {
    const messageResponse = await this.gmail.users.messages.get({
      userId: this.config.email,
      id: id,
      format: 'raw',
    });

    messageResponse.data.raw = messageResponse.data.raw
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    messageResponse.data.raw = Buffer.from(
      messageResponse.data.raw,
      'base64'
    ).toString('utf8');

    const parser = new PostalMime();

    const email = await parser.parse(messageResponse.data.raw);

    return { ...messageResponse, rawParsed: email };
  }
}
