import Table from '../table.js';
import bcrypt from 'bcrypt';

export default class UserTable extends Table {
  constructor(args) {
    super({ name: 'User', className: 'user', ...args });

    this.rolesWriteAdd('Admin');
    this.rolesDeleteAdd('Admin');
    this.rolesReadAdd('Admin');
    //this.rolesReadAdd('Authenticated');

    this.addAccessFilter(async (user, query) => {
      if (user && !(await user.userHasAnyRoleName('Admin'))) {
        query.where('id', user.id);
      }
      return [query];
    });

    this.columnAdd({
      columnName: 'name',
      friendlyName: 'Full Name',
      columnType: 'string',
      index: true,
      helpText: 'The full name of the user',
      rolesRead: ['Authenticated'],
    });

    this.columnAdd({
      columnName: 'password',
      friendlyName: 'Password',
      columnType: 'password',
      helpText: 'The password of the user',
      hidden: true,
    });

    this.columnAdd({
      columnName: 'email',
      friendlyName: 'Email Address',
      columnType: 'email',
      index: true,
      unique: true,
      helpText: 'The email address of the user',
      rolesRead: ['Authenticated'],
      onCreateOrUpdate: (email) => {
        return email?.toLowerCase();
      },
    });

    this.columnAdd({
      columnName: 'loginAllowed',
      friendlyName: 'Login Allowed',
      columnType: 'boolean',
      fieldType: 'boolean',
      defaultValue: true,
      helpText: 'Is the user allowed to login?',
    });

    this.columnAdd({
      columnName: 'title',
      friendlyName: "Job Title",
      columnType: "string",
      helpText: "The job title of the user",
      rolesRead: ["Authenticated"],
    })

    this.columnAdd({
      columnName:'department',
      friendlyName: "Department",
      columnType: "string",
      helpText: "The department of the user",
      rolesRead: ["Authenticated"],
      
      index: true,
    })

    this.columnAdd({
      columnName:'office',
      friendlyName: "Office phone",
      columnType: "phone",
      helpText: "The office phone number of the user",
      rolesRead: ["Authenticated"],
    })

    this.columnAdd({
      columnName:'cell',
      friendlyName: "Cell phone",
      columnType: "phone",
      helpText: "The cell phone number of the user",
      rolesRead: ["Authenticated"],
    })

    this.columnAdd({
      columnName:'fax',
      friendlyName: "Fax Number",
      columnType: "phone",
      helpText: "The fax number of the user",
      rolesRead: ["Authenticated"],
    })

    this.addMenuItem({
      label: 'Users',
      parent: 'Admin',
      icon: 'User',
      order: 1,
    });

    this.actionAdd({
      label: 'Reset Password',
      method: 'resetPassword',
      rolesExecute: ['Admin', 'Authenticated'],
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

    // A special user that is used for system actions
    this.addRecord({
      name: 'System',
      email: 'System@localhost',
    });

    // this is a default record that will get added after the table is created
    this.addRecord({
      name: 'admin',
      email: 'admin',
      loginAllowed: true,
      password: () => {
        const password =
          process.env.ADMIN_PASSWORD ||
          this.generatePassword({
            length: 20,
          });
        console.log('Admin Password: ', password);
        return password;
      },
    }); //

    // give the admin user the admin role
    this.addRecord({
      id: 1,
      id1: 2, // ID of admin role that is auto created
      id2: 2, // ID of the admin user that is auto created
      packageName: 'core',
      className: 'user_role',
    }); //
  }

  async objectToSearchText(object) {
    return `${object.name} ${object.email}`;
  }

  async resetPassword({
    recordId,
    Password,
    'Verify Password': verifyPassword,
    req,
  }) {
    if (process.env.DEMO_MODE == 'true') {
      throw new Error('Password resets are disabled in demo mode.');
    }

    if (!Password || !verifyPassword) {
      throw new Error('Password and Verify Password are required.');
    }

    if (Password !== verifyPassword) {
      throw new Error('Password and Verify Password must match.');
    }

    return await this.recordUpdate({
      recordId,
      data: {
        password: Password,
      },
      req,
    });
  }

  async auth(email, password) {
    const user = await this.get({
      where: { email: email.toLowerCase(), loginAllowed: true },
    });
    if (!user) {
      return false;
    }

    if (!(await this.passwordMatch(password, user.password))) {
      return false;
    }

    return user;
  }

  async getUserLoginAllowed(email) {
    return this.get({ where: { email, loginAllowed: true } });
  }

  async getUser(email) {
    return this.get({ where: { email } });
  }

  async getUserOrCreate(email) {
    const user = await this.getUser(email);
    if (user) {
      return user;
    }

    const userid = await this.recordCreate({
      data: {
        email,
        name: email,
        loginAllowed: false,
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
    const user = await this.recordGet({ where, returnPasswords: true });

    if (!user) {
      return false;
    }

    const groups = await this.packages.core.user_group.rowsGet({
      where: { id2: user.id },
    });

    user.groups = groups.rows.map((group) => group.id1);

    const user_roles = await this.packages.core.user_role.rowsGet({
      where: { id2: user.id },
    });

    const group_roles = await this.packages.core.group_role.rowsGet({
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
