export default class User {
  constructor(obj) {
    Object.assign(this, obj);
  }

  // this will return true if the current user has any of the roles passed in. If no roles are passed in, it will return true.
  async userHasAnyRoleName(...roles) {
    if (roles.length === 0) {
      // If no roles are passed in, anyone can access the thing
      return true;
    }

    if (!this.roles || this.roles.length === 0) {
      // User has no roles!
      return false;
    }

    const roleIDs = await Promise.all(
      roles.map(async (role) => {
        return await this.packages.core.role.roleNameToID(role);
      })
    );

    return roleIDs.some((roleID) => this.roles.includes(roleID));
  }
}
