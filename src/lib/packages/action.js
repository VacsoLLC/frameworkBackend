export default class Action {
  /**
   * Creates a new action with the specified properties.
   *
   * @param {Object} action - The action configuration object.
   * @param {string|null} action.id - Unique ID for the action.
   * @param {string} [action.label='No Label Provided'] - Label for the action.
   * @param {string} [action.helpText=''] - Help text displayed as a tooltip when hovering over the button.
   * @param {boolean} [action.showSuccess=true] - Whether to show a success message after the action is complete.
   * @param {number} action.actionid - ID for the action, calculated based on the number of existing actions.
   * @param {string} [action.color='primary'] - Color of the button.
   * @param {boolean} [action.close=false] - Whether to close the record after the action is complete.
   * @param {string} [action.verify=false] - If supplied a string, it will be displayed before running the action.
   * @param {Function|string|null} [action.method=null] - The method to run when the action is clicked.
   * @param {Array<string>|null} [action.rolesExecute=null] - Roles required to execute the action.
   * @param {Array<string>|null} [action.rolesNotExecute=null] - Roles that must not be present to execute the action.
   * @param {Function|null} [action.disabled=null] - Function that returns a string to disable the button.
   * @param {Object|null} [action.thisTable=null] - Reference to the table object.
   * @param {boolean} [action.noOp=false] - Whether the action is a no-op.
   * @param {string} [action.type='action'] - Type of the action, either 'action' or 'attach'.
   * @param {boolean} [action.touch=true] - Whether to display on touch screen interfaces.
   *
   * @throws {Error} If the method type is invalid.
   */
  constructor(action) {
    const newAction = {
      // Default Values
      id: null, // Unique ID for the action.
      label: '',
      helpText: '', // Help text displayed as a tool tip when hovering over the button
      showSuccess: true, // Show a success message after the action is complete
      actionid: Object.keys(action.thisTable.actions).length * 100 + 100, // this allows someone to insert an action between two actions
      color: 'primary', // Color of the button
      close: false, // Close the record after the action is complete
      verify: false, // This is a verification message that pops up before the action is run giving the user an option to cancel. If not provided, action runs immediately.
      method: null, // The method to run when the action is clicked. If not provided, other options are triggered, but no method is run. This is used for the close button.
      rolesExecute: null, // The user must have one of these roles to execute the action. If blank, all the default writers can execute the action.
      rolesNotExecute: null, // The user must NOT have any of these roles to execute the action. If blank, all the default writers can execute the action.
      disabled: null, // A function that return a string to disable the button. If the string is empty, the button is enabled. If the string is not empty, the button is disabled and the string is displayed as a tooltip.
      icon: null, // The icon to display on the button
      thisTable: null,
      noOp: false,
      type: 'action', // currently supports 'action', 'table' and 'attach'. Attach is a special type of action that is used to attach a file to a record. table are table level actions.
      touch: true, // display on touch screen interfaces
      validator: null, // a Zod schema to validate the input
      // Override the defaults with the provided values
      ...action,
    };

    // if method is a function, add it to the class.
    if (typeof newAction.method == 'function') {
      action.thisTable.methodAdd({
        id: newAction.id,
        method: newAction.method,
        validator: newAction.validator,
      });
    } else if (newAction.method === null) {
      newAction.noOp = true;
    } else {
      throw new Error(
        `Invalid method type. Method must be a function. Label: ${newAction.label}`,
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

  async disabledCheck(record, req) {
    if (this.disabled) {
      const result = await this.disabled.call(this.thisTable, {record, req});
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
    const that = {...this};

    delete that.thisTable;
    return that;
  }
}
