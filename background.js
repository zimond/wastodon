browser.runtime.onMessage.addListener(message => {
    console.log(message)
    switch (message.action) {
        case 'RequestAuthorize': {
            browser.tabs.create({
                url: 'authorize.html',
                active: true
            });
        }
    };
});