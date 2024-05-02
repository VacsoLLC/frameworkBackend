import saml2 from 'saml2-js';
import { createToken } from './token.js';

export default class Saml {
  constructor(router, db, config) {
    this.router = router;
    this.db = db;
    this.config = config;

    router.all('/saml/list', this.list.bind(this));
    router.post('/saml/:idp', this.saml.bind(this));

    this.configs = {};

    // Read config, setup objects
    for (const [key, value] of Object.entries(this.config.saml.idps)) {
      this.configs[key] = {};
      this.configs[key].config = value;

      this.configs[key].sp_options = {
        entity_id: value.entity || 'ticket',
        assert_endpoint: `https://${this.config.saml.domain}/api/saml/${key}`,
      };

      this.configs[key].idp_options = {
        sso_login_url: value.loginUrl,
        certificates: value.certificates,
        allow_unencrypted_assertion: true,
      };

      this.configs[key].sp = new saml2.ServiceProvider(
        this.configs[key].sp_options
      );

      this.configs[key].idp = new saml2.IdentityProvider(
        this.configs[key].idp_options
      );
    }
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

    return res.json(list);
  }

  async saml(req, res) {
    const idp = req.params.idp;

    const saml_response = await this.postAssertWithPromise(req.body, idp);

    console.log('saml_response', saml_response);

    const user = await this.db.core.user.getUser(saml_response.user.name_id);

    if (!user) {
      console.log('User not found');

      return res.status(402).json({ message: 'User not found.' });
    }

    console.log('Authentication successful');
    const token = createToken(user, this.config);

    return res.redirect(`/token?token=${token}`);
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
        }
      );
    });
  }

  // Wrap OOB function in a promise so we can use async/await
  postAssertWithPromise(request_body, idp) {
    return new Promise((resolve, reject) => {
      this.configs[idp].sp.post_assert(
        this.configs[idp].idp,
        { request_body },
        function (err, saml_response) {
          if (err != null) {
            reject(err);
          } else {
            resolve(saml_response);
          }
        }
      );
    });
  }
}
