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
// @grant       none
// ==/UserScript==
const WATCHER_HTML = ` <span class="font-small">[<i>Watches You</i>]</span>`;
function lowerUsername(username) {
    return username.trim().toLowerCase().replace(/(_|[^-a-zA-Z0-9])+/, "");
}
function getUsername() {
    let node = $("a#my-username.top-heading.hideonmobile").get(0);
    return (node === undefined) ? undefined : lowerUsername(node.firstChild.textContent);
}
async function getUserWatchList(username) {
    const data = await $.get(`/watchlist/to/${username}/`);
    let items = $(data).find(".watch-list-items>a");
    let usernames = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        usernames[i] = lowerUsername(items.get(i).textContent);
    }
    return usernames;
}
// Main Procedure
$(function () {
    const USERNAME = getUsername();
    console.log(`Setting user: '${USERNAME}'`);
    getUserWatchList(USERNAME).then(function (following_users) {
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
});
