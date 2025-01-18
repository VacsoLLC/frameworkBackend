import saml2 from 'saml2-js';

import Base from '../base.js';
import {z} from 'zod';

export default class Saml extends Base {
  constructor(args) {
    super({className: 'saml', ...args});
    this.authenticationRequired = false;

    this.configs = {};

    // Read config, setup objects
    for (const [key, value] of Object.entries(this.config.saml.idps)) {
      this.configs[key] = {};
      this.configs[key].config = value;

      this.configs[key].sp_options = {
        entity_id: value.entity || 'ticket',
        assert_endpoint: `https://${this.config.saml.domain}/api/core/saml/acs/${key}`,
      };

      this.configs[key].idp_options = {
        sso_login_url: value.loginUrl,
        certificates: value.certificates,
        allow_unencrypted_assertion: true,
      };

      this.configs[key].sp = new saml2.ServiceProvider(
        this.configs[key].sp_options,
      );

      this.configs[key].idp = new saml2.IdentityProvider(
        this.configs[key].idp_options,
      );
    }
    this.methodAdd({id: 'list', method: this.list, validator: z.object({})});
    this.methodAdd({
      id: 'acs',
      method: this.acs,
      validator: z.object({recordId: z.string()}),
    });
  }

  async list(req, res) {
    const list = [];

    for (const [key, value] of Object.entries(this.configs)) {
      list.push({
        id: key,
        name: value.config.name,
        link: await this.generateLink(key),
      });
    }

    return list;
  }

  async acs({recordId, req}) {
    const idp = recordId;

    const saml_response = await this.postAssertWithPromise(req.body, idp);

    const user = await this.packages.core.user.getUserLoginAllowed(
      saml_response.user.name_id,
    );

    if (!user) {
      throw new Error(`User not found ${saml_response.user.name_id}`);
    }

    console.log('Authentication successful');
    const token = this.packages.core.login._createToken({user});

    return {
      redirect: `/token?token=${token}`,
    };
  }

  // Wrap OOB function in a promise so we can use async/await
  generateLink(idp) {
    return new Promise((resolve, reject) => {
      this.configs[idp].sp.create_login_request_url(
        this.configs[idp].idp,
        {},
        function (err, login_url, request_id) {
          if (err != null) {
            reject(err);
          } else {
            resolve(login_url);
          }
        },
      );
    });
  }

  // Wrap OOB function in a promise so we can use async/await
  postAssertWithPromise(request_body, idp) {
    return new Promise((resolve, reject) => {
      this.configs[idp].sp.post_assert(
        this.configs[idp].idp,
        {request_body},
        function (err, saml_response) {
          if (err != null) {
            reject(err);
          } else {
            resolve(saml_response);
          }
        },
      );
    });
  }
}
