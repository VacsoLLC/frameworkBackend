import Table from '../../table.js';
import bcrypt from 'bcrypt';

export default class UserTable extends Table {
  constructor(args) {
    super({ name: 'User', table: 'user', ...args });

    this.addRequiredRoles('Admin');
    this.addRequiredReadRoles('Authenticated');

    this.addColumn({
      columnName: 'name',
      friendlyName: 'Full Name',
      columnType: 'string',
      index: true,
      helpText: 'The full name of the user',
    });

    this.addColumn({
      columnName: 'password',
      friendlyName: 'Password',
      columnType: 'password',
      helpText: 'The password of the user',
      hidden: true,
    });

    this.addColumn({
      columnName: 'email',
      friendlyName: 'Email Address',
      columnType: 'string',
      index: true,
      helpText: 'The email address of the user',
      onCreateOrUpdate: (email) => {
        return email.toLowerCase();
      },
    });

    this.addColumn({
      columnName: 'age',
      friendlyName: 'Age',
      columnType: 'integer',
      helpText: 'The age of the user',
    });

    // Example usage with custom column name and displayColumns (though displayColumns isn't directly utilized in schema creation)
    this.addManyToOne({
      referencedTableName: 'dept',
      columnName: 'dept',
      displayColumns: [{ columnName: 'name', friendlyName: 'Department Name' }],
      tabName: 'Users',
    });

    this.addMenuItem({
      label: 'Users',
      parent: 'Admin',
      icon: 'pi-user',
      order: 1,
    });

    this.addAction({
      label: 'Reset Password',
      method: 'resetPassword',
      verify:
        'Enter a new password in the first field, and confirm it in the second field.',
      inputs: {
        Password: {
          fieldType: 'password',
          required: true,
        },
        'Verify Password': {
          fieldType: 'password',
          required: true,
        },
      },
    });

    // this is a default record that will get added after the table is created
    this.addRecord({
      id: 1,
      name: 'Admin',
      email: 'admin',
      password: () => {
        const password = this.generatePassword({ length: 20 });
        console.log('Admin Password: ', password);
        return bcrypt.hashSync(password, 10);
      },
    }); //

    // give the admin user the admin role
    this.addRecord({
      id: 1,
      id1: 2, // ID of admin role that is auto created
      id2: 1, // ID of the admin user that is auto created
      db: 'core',
      table: 'user_role',
    }); //
  }

  async resetPassword({
    recordId,
    Password,
    'Verify Password': verifyPassword,
    req,
  }) {
    if (!Password || !verifyPassword) {
      throw new Error('Password and Verify Password are required.');
    }

    if (Password !== verifyPassword) {
      throw new Error('Password and Verify Password must match.');
    }

    return await this.updateRecord({
      recordId,
      data: {
        password: Password,
      },
      req,
    });
  }

  async auth(email, password) {
    const user = await this.get({ where: { email: email.toLowerCase() } });
    if (!user) {
      return false;
    }

    if (!(await this.passwordMatch(password, user.password))) {
      return false;
    }

    return user;
  }

  async getUser(email) {
    return this.get({ where: { email } });
  }

  async getUserOrCreate(email) {
    const user = await this.getUser(email);
    if (user) {
      return user;
    }

    const userid = this.createRecord({
      data: {
        email,
        name: email,
      },
      req: {
        user: {
          id: '0',
        },
        action: 'Ticket Create from Email',
      },
    });

    const newUser = await this.getUser(email);
    if (newUser) {
      return newUser;
    } else {
      throw new Error('Failed to create user');
    }
  }

  async get({ where }) {
    const user = await this.getRecord({ where, returnPasswords: true });

    if (!user) {
      return false;
    }

    const groups = await this.dbs.core.user_group.getRows({
      where: { id2: user.id },
    });

    user.groups = groups.rows.map((group) => group.id1);

    const user_roles = await this.dbs.core.user_role.getRows({
      where: { id2: user.id },
    });

    const group_roles = await this.dbs.core.group_role.getRows({
      where: { id2: user.id },
    });

    user.roles = this.combineUnique(
      user_roles.rows.map((role) => role.id1),
      group_roles.rows.map((role) => role.id1),
      [1] // Everyone gets role 1, which is authenticated
    );
    return user;
  }

  combineUnique(arr1, arr2, arr3 = []) {
    // Combine the two arrays and remove duplicates by converting to a Set, then back to an array
    const combinedUniqueArray = [...new Set([...arr1, ...arr2, ...arr3])];
    return combinedUniqueArray;
  }

  async passwordMatch(enteredPassword, storedHash) {
    try {
      const match = await bcrypt.compare(enteredPassword, storedHash);
      if (match) {
        // Passwords match
        console.log('Passwords match');
        return true;
      } else {
        // Passwords don't match
        console.log('Passwords do not match');
        return false;
      }
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return false;
    }
  }

  generatePassword({
    length = 20,
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=',
  }) {
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
  }
}
//this.dbs.core.user_group
