// ==UserScript==
// @name        FurAffinity "Watches You" flair
// @namespace   furaffinity-watch-flair
// @version     0.2
// @description Adds flairs to users who watch you
// @author      https://github.com/Raptor4694
// @run-at      document-ready
// @match       *://www.furaffinity.net/journal/*
// @match       *://www.furaffinity.net/user/*
// @match       *://www.furaffinity.net/gallery/*
// @match       *://www.furaffinity.net/scraps/*
// @match       *://www.furaffinity.net/favorites/*
// @match       *://www.furaffinity.net/journals/*
// @match       *://www.furaffinity.net/commissions/*
// @match       *://www.furaffinity.net/view/*
// @match       *://www.furaffinity.net/msg/pms/*
// @require     https://code.jquery.com/jquery-latest.js
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==
"use strict";
/* MODIFY THESE CONSTANTS TO SUIT YOUR PREFERENCES */
const SAVE_ENABLED = true;
const WATCHER_HTML_MODERN = ` <span class="font-small">[<i>Watches You</i>]</span>`;
const WATCHER_HTML_CLASSIC = ` [<i>Watches You</i>]`;
const MINUTES_BETWEEN_WATCHLIST_UPDATE = 5;
const MINUTES_BETWEEN_BLOCKLIST_UPDATE = 60;
/**
 * @param username The username
 * @returns Whether it has been more than MINUTES_BETWEEN_UPDATE minutes since we last retrieved
 *          the user's watchlist from the site and saved it into local storage.
 */
async function shouldUpdate(listname, username, minMinuteDiff) {
    if (!SAVE_ENABLED)
        return true;
    const now = Date.now();
    const then = await GM_getValue(`${username}.${listname}.timeLastUpdated`, -1);
    if (then < 0) {
        console.log(`Last updated ${listname}: never`);
        return true;
    }
    const minuteDiff = (now - then) / (60000 /* number of milliseconds in 1 minute */);
    console.log(`Last updated ${listname}: ${then} (${minuteDiff} minutes ago)`);
    return minuteDiff > minMinuteDiff;
}
/**
 * Extracts a username from a link such as "/user/raptor4694/"
 * @param link The link
 */
function getUsernameFromRelativeLink(link) {
    const match = /\/user\/([-a-z0-9]+)\/?/g.exec(link);
    if (match == null)
        return null;
    return match[1];
}
/**
 * Extracts a username from an HTMLElement's 'href' attribute
 * @param element The element
 */
function getUsernameFromHref(element) {
    let href = element?.getAttribute('href');
    if (href == null)
        return null;
    return getUsernameFromRelativeLink(href);
}
/**
 * @returns The currently logged in user's username or null.
 */
function getUsername() {
    let username = getUsernameFromHref($(`a#my-username[href^="/user/"]`).get(0));
    if (username)
        console.log(`Setting user: '${username}'`);
    return username;
}
/**
 * Retrieves the given page and returns an array of all the links to userpages within it
 * @param url The url to retrieve
 */
async function retrieveAllUserHrefs(url) {
    const data = await $.get(url);
    let items = $(data).find(`a[href^="/user/"]`);
    let usernames = new Array(items.length);
    let actualLength = 0;
    for (var i = 0; i < items.length; i++) {
        let username = getUsernameFromHref(items.get(i));
        if (username != null) {
            usernames[actualLength++] = username;
        }
    }
    usernames.length = actualLength;
    return usernames;
}
/**
 * Actually performs a request to retrieve the user's watchlist
 * @param username The username to retrieve the watchlist of
 */
async function retrieveUserWatchList(username) {
    let usernames = await retrieveAllUserHrefs(`/watchlist/to/${username}/`);
    if (usernames.length > 0) {
        let i = 2;
        do {
            var moreUsernames = await retrieveAllUserHrefs(`/watchlist/to/${username}/${i}/`);
            usernames.push(...moreUsernames);
            i++;
        } while (moreUsernames.length > 0);
    }
    if (SAVE_ENABLED) {
        GM_setValue(`${username}.watchlist.timeLastUpdated`, Date.now());
        GM_setValue(`${username}.watchlist`, usernames.join(','));
        console.log(`Updated locally-saved user watchlist (${usernames.length} entries)`);
    }
    else {
        console.log(`Retrieved user watchlist (${usernames.length} entries)`);
    }
    return usernames;
}
/**
 * Actually performs a request to retrieve the user's blocklist
 * @param username The username to retrieve the blocklist of
 */
async function retrieveUserBlockList(username) {
    const data = await $.get(`/controls/profile/`);
    const textarea = $(data).find(`textarea[name="blocklist"]`).get(0);
    const usernames = textarea.textContent?.split('\n') ?? [];
    if (SAVE_ENABLED) {
        GM_setValue(`${username}.blocklist.timeLastUpdated`, Date.now());
        GM_setValue(`${username}.blocklist`, usernames.join(','));
        console.log(`Updated locally-saved user blocklist (${usernames.length} entries)`);
    }
    else {
        console.log(`Retrieved user blocklist (${usernames.length} entries)`);
    }
    return usernames;
}
/**
 * Gets a user's watchlist
 * @param username The username to retrieve the watchlist of
 */
async function getUserWatchList(username) {
    if (!SAVE_ENABLED || await shouldUpdate('watchlist', username, MINUTES_BETWEEN_WATCHLIST_UPDATE)) {
        return retrieveUserWatchList(username);
    }
    else {
        let usernames_str = await GM_getValue(`${username}.watchlist`, "!");
        if (usernames_str == "!") {
            return retrieveUserWatchList(username);
        }
        else {
            return usernames_str.split(',');
        }
    }
}
/**
 * Gets a user's blocklist
 * @param username The username to retrieve the blocklist of
 */
async function getUserBlockList(username) {
    if (!SAVE_ENABLED || await shouldUpdate('blocklist', username, MINUTES_BETWEEN_BLOCKLIST_UPDATE)) {
        return retrieveUserBlockList(username);
    }
    else {
        let usernames_str = await GM_getValue(`${username}.blocklist`, "!");
        if (usernames_str == "!") {
            return retrieveUserBlockList(username);
        }
        else {
            return usernames_str.split(',');
        }
    }
}
// Main Procedure
const isClassic = document.body.getAttribute('data-static-path') == "/themes/classic";
console.log(`${isClassic ? "Classic" : "Modern"} theme detected!`);
const page = document.URL.substring(document.URL.indexOf("furaffinity.net/") + 16);
const isUserpage = page.startsWith("user/");
if (isUserpage)
    console.log(`Userpage detected!`);
const isJournal = page.startsWith("journal/");
if (isJournal)
    console.log(`Journal detected!`);
const isNote = page.startsWith("msg/pms/");
if (isNote)
    console.log(`Note detected!`);
const ACTIVE_USER = getUsername();
function tagWatchers(following_users) {
    console.log(`There are ${following_users.length} users watching ${ACTIVE_USER}`);
    if (following_users.length == 0)
        return;
    function isWatcher(username) {
        return username != null && following_users.includes(username);
    }
    if (isClassic) {
        // comments
        if (!(isUserpage || isNote))
            $(`.container-comment`).each(function () {
                const username = getUsernameFromHref($(this).find(`a[href^="/user/"]`).get(0));
                if (username == ACTIVE_USER) {
                    console.log(`Comment poster: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).find(`.replyto-name`).after(WATCHER_HTML_CLASSIC);
                    console.log(`Comment poster: '${username}' => watches you`);
                }
                else {
                    console.log(`Comment poster: '${username}' => does not watch you`);
                }
            });
        // shouts
        if (isUserpage)
            $(`table#page-userpage>tbody>tr:nth-child(2)>td:nth-child(2)>table[id^="shout-"] div.from-header>a[href^="/user/"]`).each(function () {
                const username = getUsernameFromHref(this);
                if (username == ACTIVE_USER) {
                    console.log(`Comment poster: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).after(WATCHER_HTML_CLASSIC);
                    console.log(`Comment poster: '${username}' => watches you`);
                }
                else {
                    console.log(`Comment poster: '${username}' => does not watch you`);
                }
            });
        // page owner
        if (isUserpage)
            $(`td.cat tbody>tr>td.addpad.lead`).each(function () {
                const match = /\bfuraffinity\.net\/user\/([-a-z0-9]+)(\/.*)?$/.exec(document.URL);
                if (!match)
                    return;
                const username = match[1];
                if (username == ACTIVE_USER) {
                    console.log(`Page owner: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).find(`br:last-child`).before(WATCHER_HTML_CLASSIC);
                    console.log(`Page owner: '${username}' => watches you`);
                }
                else {
                    console.log(`Page owner: '${username}' => does not watch you`);
                }
            });
        // submission owner
        if (!(isUserpage || isNote))
            $(`.classic-submission-title.information>a[href^="/user/"]`).each(function () {
                const username = getUsernameFromHref(this);
                if (username == ACTIVE_USER) {
                    console.log(`Submission owner: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).after(WATCHER_HTML_CLASSIC);
                    console.log(`Submission owner: '${username}' => watches you`);
                }
                else {
                    console.log(`Submission owner: '${username}' => does not watch you`);
                }
            });
        // journal owner
        if (isJournal)
            $(`.journal-title-box>a[href^="/user/"]`).each(function () {
                const username = getUsernameFromHref(this);
                if (username == ACTIVE_USER) {
                    console.log(`Journal poster: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).after(WATCHER_HTML_CLASSIC);
                    console.log(`Journal poster: '${username}' => watches you`);
                }
                else {
                    console.log(`Journal poster: '${username}' => does not watch you`);
                }
            });
        // note sender
        if (isNote)
            $(`.note-view-container .alt1.head>.title~em>a[href^="/user/"]`).each(function () {
                const username = getUsernameFromHref(this);
                if (username == ACTIVE_USER) {
                    console.log(`Note sender: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).after(WATCHER_HTML_CLASSIC);
                    console.log(`Note sender: '${username}' => watches you`);
                }
                else {
                    console.log(`Note sender: '${username}' => does not watch you`);
                }
            });
    }
    else /* modern theme */ {
        // comments/shouts
        if (!isNote)
            $(`.comment_container`).each(function () {
                const username = getUsernameFromHref($(this).find(`.comment_anchor~div>a[href^="/user/"]`).get(0));
                if (username == ACTIVE_USER) {
                    console.log(`Comment poster: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).find(isUserpage ? `.comment_username` : `.cell>a.inline+span`).after(WATCHER_HTML_MODERN);
                    console.log(`Comment poster: '${username}' => watches you`);
                }
                else {
                    console.log(`Comment poster: '${username}' => does not watch you`);
                }
            });
        // page/journal owner
        if (isUserpage || isJournal)
            $(`.user-profile-main`).each(function () {
                const username = getUsernameFromHref($(this).find(`.user-nav-avatar-desktop>a[href^="/user/"]`).get(0));
                if (username == ACTIVE_USER) {
                    console.log(`Page owner: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).find(`.username span[title]`).after(WATCHER_HTML_MODERN);
                    console.log(`${isUserpage ? 'Page owner' : 'Journal poster'}: '${username}' => watches you`);
                }
                else {
                    console.log(`${isUserpage ? 'Page owner' : 'Journal poster'}: '${username}' => does not watch you`);
                }
            });
        // submission owner
        if (!(isUserpage || isJournal))
            $(`.submission-id-sub-container`).each(function () {
                const username = getUsernameFromHref($(this).find(`a[href^="/user/"]`).get(0));
                if (username == ACTIVE_USER) {
                    console.log(`Submission owner: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).append(WATCHER_HTML_MODERN);
                    console.log(`Submission owner: '${username}' => watches you`);
                }
                else {
                    console.log(`Submission owner: '${username}' => does not watch you`);
                }
            });
        // note sender
        if (isNote)
            $(`#message .message-center-note-information.addresses>a[href^="/user/"]`).first().each(function () {
                const username = getUsernameFromHref(this);
                if (username == ACTIVE_USER) {
                    console.log(`Note sender: '${username}' => is you`);
                }
                else if (isWatcher(username)) {
                    $(this).after(WATCHER_HTML_CLASSIC);
                    console.log(`Note sender: '${username}' => watches you`);
                }
                else {
                    console.log(`Note sender: '${username}' => does not watch you`);
                }
            });
    }
}
function tagBlockedUsers(blocked_users) {
    console.log(`${ACTIVE_USER} has blocked ${blocked_users.length} users.`);
    if (blocked_users.length === 0)
        return;
    function isBlocked(username) {
        return username != null && blocked_users.includes(username);
    }
    $(`a[href^="/user/"]`).each(function () {
        const username = getUsernameFromHref(this);
        if (username != ACTIVE_USER && isBlocked(username)) {
            console.log(`Blocked user: ${username}`);
            $(this).find(`*`).each(function () {
                if (this.childElementCount === 0 && (this.textContent || "").trim().length > 0) {
                    this.style.cssText += "color:darkred !important;";
                }
            });
        }
    });
}
if (ACTIVE_USER == null) {
    console.log(`Couldn't retrieve username!`);
}
else {
    getUserWatchList(ACTIVE_USER).then(tagWatchers);
    getUserBlockList(ACTIVE_USER).then(tagBlockedUsers);
}
