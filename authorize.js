function authorize() {
    let username = document.getElementById('username').value;
    let domain = document.getElementById('domain').value;
    let form = new FormData();
    let redirect_uri = browser.identity.getRedirectURL();
    form.append('client_name', 'Wastodon');
    form.append('redirect_uris', redirect_uri);
    form.append('scopes', 'write');
    let url = `https://${domain}/api/v1/apps`;
    let client;
    fetch(`https://${domain}/api/v1/apps`, {
        method: 'POST',
        body: form,
        mode: 'cors'
    }).then(res => {
        return res.json();
    }).then(res => {
        client = {
            client_id: res.client_id,
            client_secret: res.client_secret,
            domain: domain
        };
        // start OAuth
        return browser.identity.launchWebAuthFlow({
            url: `https://${domain}/oauth/authorize?client_id=${client.client_id}&scope=write&redirect_uri=${redirect_uri}&response_type=code`,
            interactive: true
        });
    }).then(code => {
        // use code to get access token
        code = code.split("code=").pop();
        let form = new FormData();
        form.set('client_id', client.client_id);
        form.set('client_secret', client.client_secret);
        form.set('grant_type', 'authorization_code');
        form.set('redirect_uri', redirect_uri);
        form.set('code', code);
        client.code = code;
        return fetch(`https://${domain}/oauth/token`, {
            method: 'POST',
            body: form,
            mode: 'cors'
        }).then(res => {
            return res.json();
        })
    }).then(token => {
        if (token.error) {
            throw token;
        }
        client.token = token;
        // everything prepared, store them
        return browser.storage.sync.set(client);
    }).then(() => {
        window.location.reload();
    }).catch(e => {
        console.error(e)
    })
}

function init() {
    browser.storage.sync.get('token').then(token => {
        let authorized = !!token.token;
        if (authorized) {
            document.getElementById('authorized').style.display = 'block';
            document.getElementById('main').style.display = 'none';
        } else {
            document.getElementById('authorized').style.display = 'none';
            document.getElementById('main').style.display = 'block';
        }

        for (let button of document.getElementsByClassName('next-button')) {
            button.addEventListener('click', () => {
                if (authorized) {
                    browser.storage.sync.remove('token');
                    window.location.reload();
                } else {
                    authorize();
                }
            });
        }
    })
}

init();
