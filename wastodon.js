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
    // check if this button is disabled
    if (node.getAttribute('data-wastodon-enabled') === 'false') {
        return;
    }
    let card = seekCurrentCard(node);
    // check if authorized
    authorizeMastodon().then(({ header, domain }) => {
        let data = fetchWeiboText(card);
        let reblog = `${data.author}: ${data.text} (转自微博 ${data.ref}`;
        let form = new FormData();
        form.set('status', reblog);
        form.set('visibility', 'public');
        changeButtonStatus(node, 'loading');
        return tryUploadImages(card, header, domain).then(ids => {
            for (let id of ids) {
                form.append('media_ids[]', id);
            }
            return fetch(`https://${domain}/api/v1/statuses`, {
                body: form,
                mode: 'cors',
                method: 'POST',
                headers: header
            })
        })
    }).then(res => res.json()).then(res => {
        changeLoadingText(card, '转推成功');
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

function seekCurrentCard(node) {
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
    else return parent;
}

function fetchWeiboText(card) {
    let refElement = card.querySelector('a[node-type="feed_list_item_date"]');
    let ref = '';
    if (refElement) {
        ref = refElement.href.split('?').shift();
    }
    let author = card.querySelector('.WB_info > a.W_fb').getAttribute('title') || '';
    let textBlocks = card.querySelectorAll('.WB_text');
    let text = textBlocks.item(textBlocks.length - 1).innerText;
    text = text.split('收起全文d').shift();
    return {
        text,
        ref,
        author
    }
}

function changeButtonStatus(node, type) {
    node = node.parentNode;
    if (type === 'loading') {
        let loading = document.createElement('span');
        loading.className = 'wastodon-loading';
        loading.innerHTML = '正在发送...';
        loading.setAttribute('data-wastodon-enabled', 'false');
        node.parentNode.replaceChild(loading, node);
    }
}

function changeLoadingText(card, text) {
    let loading = card.querySelector('.wastodon-loading');
    loading.innerText = text;
}

function tryUploadImages(card, header, domain) {
    let images = card.querySelectorAll('.WB_media_a > .WB_pic > img');
    // we currently only use the first 4 images
    images = Array.prototype.slice.call(images).map(img => img.src.replace('thumb150', 'mw690')).slice(0, 4);
    return Promise.all(images.map(img => {
        return fetch(img).then(res => res.blob())
    })).then(images => {
        return Promise.all(images.map((image, index) => {
            // upload this image
            changeLoadingText(card, `上传图片 ${index + 1}/${images.length}`);
            let form = new FormData();
            form.set('file', image);
            return fetch(`https://${domain}/api/v1/media`, {
                body: form,
                mode: 'cors',
                method: 'POST',
                headers: header
            }).then(res => res.json())
        }));
    }).then(results => {
        return results.map(res => res.id);
    }).catch(e => {
        changeLoadingText(card, '上传图片失败');
        console.error(e);
        throw e;
    });
}