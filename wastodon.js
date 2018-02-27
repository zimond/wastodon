function captureFeedLoad(callback) {
    const weiboMainElement = document.getElementsByClassName('WB_miniblog_fb').item(0);
    const feedsObserver = new MutationObserver(mutations => {
        if (document.getElementsByClassName('WB_feed').length > 0) {
            // feeds loaded, stop observing
            feedsObserver.disconnect();
            const feedsContainer = document.getElementsByClassName('WB_feed').item(0);
            const feedObserver = new MutationObserver(mutations => {
                for (let record of mutations) {
                    for (let node of record.addedNodes) {
                        if (node.className && node.className.includes('WB_cardwrap')) {
                            callback(node);
                        }
                    }
                }
            });
            feedObserver.observe(feedsContainer, {
                attributes: false,
                characterData: false,
                childList: true
            });
            // insert css
            let css = document.createElement('style');
            css.innerHTML = `
            .WB_row_r4 li {
                width: 20%;
            }`;
            document.body.appendChild(css);
            callback(document.body);
        }
    });
    feedsObserver.observe(weiboMainElement, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['innerHTML']
    });
}

captureFeedLoad(node => {
    let handles = Array.prototype.slice.call(node.getElementsByClassName('WB_handle'));
    handles.forEach(element => {
        let reblogButton = document.createElement('li');
        reblogButton.className = 'wastodon-button wastodon-reblog-button';
        reblogButton.appendChild(createSLine().body.children.item(0));
        reblogButton.addEventListener('mousedown', onReblog, true);
        element.querySelector('ul').appendChild(reblogButton);
    });
});

const parser = new DOMParser();

function createSLine() {
    let line = `<span class="line S_line1">
        <a class="S_txt2">
            <span>
                <em class="W_ficon ficon_forward S_ficon"></em>
                <em>转推CMX</em>
            </span>
        </a>
    </span>`;
    return parser.parseFromString(line, 'text/html');
}

function onReblog(e) {
    let node = e.target;
    // check if authorized
    authorizeMastodon().then(({ header, domain }) => {
        let data = fetchWeiboText(node);
        let reblog = `${data.author}: ${data.text} (转自微博 ${data.ref}`;
        let form = new FormData();
        form.set('status', reblog);
        form.set('visibility', 'public');
        return fetch(`https://${domain}/api/v1/statuses`, {
            body: form,
            mode: 'cors',
            method: 'POST',
            headers: header
        })
    }).then(res => res.json()).then(res => {
        console.log(res)
    }).catch(e => {
        console.error(e)
    })
}

function authorizeMastodon() {
    return browser.storage.sync.get(['token', 'domain']).then(result => {
        let authorized = !!result.token;
        if (!!authorized) {
            let header = {
                Authorization: `Bearer ${result.token.access_token}`
            };
            return { header, domain: result.domain };
        } else {
            return browser.runtime.sendMessage({
                action: 'RequestAuthorize'
            });
        }
    })
}

function fetchWeiboText(node) {
    let parent = node.parentElement;
    let inRetweet = false;
    while (parent !== document.body) {
        if (parent.className.includes('WB_feed_expand')) {
            inRetweet = true;
            break
        } else if (parent.className.includes('WB_cardwrap')) {
            break;
        } else {
            parent = parent.parentElement;
        }
    }
    if (parent === node) return undefined;
    let refElement = parent.querySelector('a[node-type="feed_list_item_date"]');
    let ref = '';
    if (refElement) {
        ref = refElement.href.split('?').shift();
    }
    let text = (parent.querySelector('.WB_text') || {}).innerText || '';
    let author = parent.querySelector('.WB_info > a.W_fb').getAttribute('title') || '';
    return {
        text,
        ref,
        author
    }
}