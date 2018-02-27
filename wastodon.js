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
    console.log(handles)
    handles.forEach(element => {
        let reblogButton = document.createElement('li');
        reblogButton.className = 'wastodon-button wastodon-reblog-button';
        reblogButton.appendChild(createSLine().body.children.item(0));
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

function onReblog(node) {
    // check if authorized
    authorizeMastodon();
}

function authorizeMastodon() {

}