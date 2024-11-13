import Base from '../base.js';

import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import { ClientSecretCredential } from '@azure/identity';
import { systemRequest } from '../../../../src/util.js';

export default class UserSync extends Base {
  constructor(args) {
    super({ className: 'usersync', ...args });

    this.methodAdd('sync', this.sync);
    if (
      this.config.usersync &&
      this.config.usersync.enabled &&
      this.config.usersync.tenantId &&
      this.config.usersync.clientId &&
      this.config.usersync.clientSecret &&
      this.config.usersync.syncInterval
    ) {
      setInterval(() => {
        this.sync();
      }, this.config.usersync.syncInterval);
    }
  }

  async sync() {
    this.listUsers();
  }

  initializeGraphClient() {
    const credential = new ClientSecretCredential(
      this.config.usersync.tenantId,
      this.config.usersync.clientId,
      this.config.usersync.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    return Client.initWithMiddleware({ authProvider });
  }

  async listUsers() {
    try {
      const graphClient = this.initializeGraphClient();

      console.log('Fetching users from Office 365...\n');

      const response = await graphClient
        .api('/users')
        .select(
          'displayName,userPrincipalName,mail,jobTitle,department,businessPhones,mobilePhone,faxNumber'
        )
        .get();

      const usersWithEmail = response.value.filter(
        (user) => user.mail && user.mail.trim() !== ''
      );

      // Print users in a formatted table
      console.table(
        usersWithEmail.map((user) => ({
          'Display Name': user.displayName,
          Email: user.mail,
          UPN: user.userPrincipalName,
          'Job Title': user.jobTitle || 'N/A',
          Department: user.department || 'N/A',
          'Office Phone':
            user.businessPhones && user.businessPhones[0]
              ? user.businessPhones[0]
              : 'N/A',
          'Mobile Phone': user.mobilePhone || 'N/A',
          Fax: user.faxNumber || 'N/A',
        }))
      );

      const records = await this.packages.core.user.rowsGet({});

      const localUsers = {};

      for (const record of records.rows) {
        if (!record.email.includes('@')) {
          continue;
        } // skip records where the email isnt an email
        localUsers[record.email] = record;
      }

      for (const syncedUser of usersWithEmail) {
        console.log(`User: ${syncedUser.displayName}`);

        const email = syncedUser.mail.toLowerCase();

        if (!localUsers[email]) {
          console.log(`Creating user: ${syncedUser.displayName}`);
          await this.packages.core.user.recordCreate({
            data: {
              name: syncedUser.displayName,
              email: syncedUser.mail,
              loginAllowed: true,
            },
            req: systemRequest(this),
          });
        } else if (
          localUsers[email].name != syncedUser.displayName ||
          localUsers[email].title != syncedUser.jobTitle ||
          localUsers[email].department != syncedUser.department ||
          localUsers[email].office != syncedUser.businessPhones[0] ||
          localUsers[email].cell != syncedUser.mobilePhone ||
          localUsers[email].fax != syncedUser.faxNumber
        ) {
          console.log(`Updating user: ${syncedUser.displayName}`);
          await this.packages.core.user.recordUpdate({
            recordId: localUsers[email].id,
            data: {
              name: syncedUser.displayName,
              title: syncedUser.jobTitle,
              department: syncedUser.department,
              office: syncedUser.businessPhones[0],
              cell: syncedUser.mobilePhone,
              fax: syncedUser.faxNumber,
            },
            message: 'Updated by user sync',
            req: systemRequest(this),
          });
        } else {
          console.log(
            `User already exists and needs no updates: ${syncedUser.displayName}`
          );
        }
      }

      console.log(`\nTotal users: ${response.value.length}`);
      console.log(`Users with email Addresses: ${usersWithEmail.length}`);
    } catch (error) {
      console.error('Error fetching users:', error.message);
    }
  }
}
