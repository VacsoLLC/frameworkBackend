export default class Action {
  constructor(action) {
    const newAction = {
      // Default Values
      id: null, // Unique ID for the action.
      label: 'No Label Provided',
      helpText: '', // Help text displayed as a tool tip when hovering over the button
      showSuccess: true, // Show a success message after the action is complete
      actionid: Object.keys(action.thisTable.actions).length * 100 + 100, // this allows someone to insert an action between two actions
      color: 'primary', // Color of the button
      close: false, // Close the record after the action is complete
      verify: false, // This is a verification message that pops up before the action is run giving the user an option to cancel. If not provided, action runs immediately.
      method: false, // The method to run when the action is clicked. If not provided, other options are triggered, but no method is run. This is used for the close button.
      rolesExecute: null, // The user must have one of these roles to execute the action. If blank, all the default writers can execute the action.
      rolesNotExecute: null, // The user must NOT have any of these roles to execute the action. If blank, all the default writers can execute the action.
      disabled: null, // A function that return a string to disable the button. If the string is empty, the button is enabled. If the string is not empty, the button is disabled and the string is displayed as a tooltip.
      thisTable: null,
      // Override the defaults with the provided values
      ...action,
    };

    // if method is a function, add it to the class. if its a string, add its function to the class
    if (
      typeof newAction.method == 'string' &&
      action.thisTable[newAction.method]
    ) {
      action.thisTable.methodAdd(
        newAction.id,
        action.thisTable[newAction.method],
        action.thisTable.actionValidate
      );
    } else if (typeof newAction.method == 'function') {
      action.thisTable.methodAdd(
        newAction.id,
        newAction.method,
        action.thisTable.actionValidate
      );
    } else {
      throw new Error(
        `Invalid method type. Method must be a name of a method on the table's class or a function. ID: ${id} Label: ${newAction.label}`
      );
    }

    if (newAction.rolesExecute != null) {
      action.thisTable.rolesWriteAllAdd(...newAction.rolesExecute);
    }

    // Apply all properties from newAction to this instance
    Object.assign(this, newAction);
  }

  async haveAccess(req) {
    if (
      this.rolesNotExecute &&
      this.rolesNotExecute?.length > 0 &&
      (await req.user.userHasAnyRoleName(...this.rolesNotExecute))
    ) {
      return false;
    }

    if (this.rolesExecute && this.rolesExecute?.length > 0) {
      if (!(await req.user.userHasAnyRoleName(...this.rolesExecute))) {
        return false;
      }
    } else if (this.rolesWrite && this.rolesWrite.length > 0) {
      if (!(await req.user.userHasAnyRoleName(...this.rolesWrite))) {
        return false;
        s;
      }
    }

    return true;
  }

  async disabledCheck(that, record, req) {
    if (this.disabled) {
      const result = await this.disabled.call(that, { record, req });
      if (result) {
        return result;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  toJSON() {
    const that = { ...this };

    delete that.thisTable;
    return that;
  }
}
