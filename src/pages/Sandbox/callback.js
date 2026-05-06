import { UserManager } from 'oidc-client-ts';

const config = {
  authority: 'https://api.slingui.com/auth/oidc',
  client_id: 'screenity-extension',
};

new UserManager(config).signinCallback().then(() => {
  window.close();
}).catch((e) => {
  console.error(e);
});
