// ==UserScript==
// @name        FurAffinity "Watches You" flair
// @namespace   furaffinity-watch-flair
// @version     0.1
// @description Adds flairs to users who watch you
// @author      You
// @match       https://www.furaffinity.net/journal/*
// @match       https://www.furaffinity.net/user/*
// @match       https://www.furaffinity.net/gallery/*
// @match       https://www.furaffinity.net/scraps/*
// @match       https://www.furaffinity.net/favorites/*
// @match       https://www.furaffinity.net/journals/*
// @match       https://www.furaffinity.net/commissions/*
// @match       https://www.furaffinity.net/view/*
// @require     http://code.jquery.com/jquery-latest.js
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==
const WATCHER_HTML = ` <span class="font-small">[<i>Watches You</i>]</span>`;
const MINUTES_BETWEEN_UPDATE = 5;
const MILLISECONDS_PER_MINUTE = 1000 * 60;
function lowerUsername(username) {
    return username.trim().toLowerCase().replace(/(_|[^-a-zA-Z0-9])+/g, "");
}
async function shouldUpdate() {
    const now = new Date;
    const then = new Date(await GM_getValue('timeLastUpdated', now.getTime()));
    return Math.floor((then.getTime() - now.getTime()) / MILLISECONDS_PER_MINUTE) > MINUTES_BETWEEN_UPDATE;
}
/**
 * @return The currently logged in user's username or null
 */
function getUsername() {
    let node = $("a#my-username.top-heading.hideonmobile").get(0);
    return (node === undefined) ? null : lowerUsername(node.firstChild.textContent);
}
async function retrieveUserWatchList(username) {
    const data = await $.get(`/watchlist/to/${username}/`);
    let items = $(data).find(".watch-list-items>a");
    let usernames = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        usernames[i] = lowerUsername(items.get(i).textContent);
    }
    await GM_setValue('timeLastUpdated', Date.now());
    await GM_setValue('usernames', usernames.join(','));
    console.log("Updated locally-saved user watchlist");
    return usernames;
}
async function getUserWatchList(username) {
    let usernames;
    if (await shouldUpdate()) {
        usernames = await retrieveUserWatchList(username);
    }
    else {
        let usernames_str = await GM_getValue('usernames', "");
        if (usernames_str.length == 0) {
            usernames = await retrieveUserWatchList(username);
        }
        else {
            usernames = usernames_str.split(',');
        }
    }
    return usernames;
}
// Main Procedure
const USERNAME = getUsername();
if (USERNAME != null) {
    console.log(`Setting user: '${USERNAME}'`);
    getUserWatchList(USERNAME).then((following_users) => {
        function isWatcher(username) {
            return $.inArray(username, following_users) !== -1;
        }
        // comments
        $(".comment_container").each(function () {
            let comment_username_node = $(this).find(".comment_username").get(0);
            if (comment_username_node === undefined) {
                return;
            }
            let username = lowerUsername(comment_username_node.textContent);
            console.log(`Comment poster: '${username}'`);
            if (isWatcher(username)) {
                switch (comment_username_node.nodeName) {
                    case "STRONG":
                        $(this).find("a+span.hideonmobile.font-small").after(WATCHER_HTML);
                        break;
                    case "DIV":
                        $(comment_username_node).after(WATCHER_HTML);
                        break;
                }
            }
        });
        // page owner
        $(".userpage-flex-item.username>h2>span").each(function () {
            let username = lowerUsername(this.textContent);
            console.log(`Page owner: '${username}'`);
            if (isWatcher(username)) {
                $(this).append(WATCHER_HTML);
            }
        });
        // submission owner
        $(".submission-id-sub-container").each(function () {
            let username_node = $(this).find("a>strong").get(0);
            if (username_node === undefined) {
                return;
            }
            let username = lowerUsername(username_node.textContent);
            if (isWatcher(username)) {
                $(this).append(WATCHER_HTML);
            }
        });
    });
}
