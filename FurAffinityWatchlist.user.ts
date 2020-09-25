// ==UserScript==
// @name        FurAffinity "Watches You" flair
// @namespace   furaffinity-watch-flair
// @version     0.1
// @description Adds flairs to users who watch you
// @author      https://github.com/Raptor4694
// @run-at      document-ready
// @match       https://www.furaffinity.net/journal/*
// @match       https://www.furaffinity.net/user/*
// @match       https://www.furaffinity.net/gallery/*
// @match       https://www.furaffinity.net/scraps/*
// @match       https://www.furaffinity.net/favorites/*
// @match       https://www.furaffinity.net/journals/*
// @match       https://www.furaffinity.net/commissions/*
// @match       https://www.furaffinity.net/view/*
// @match       https://www.furaffinity.net/msg/pms/*
// @require     http://code.jquery.com/jquery-latest.js
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

declare function GM_getValue<T extends string|number|boolean>(name: string, defaultValue: T): Promise<T>
declare function GM_setValue<T extends string|number|boolean>(name: string, value: T): Promise<T>

/* MODIFY THESE CONSTANTS TO SUIT YOUR PREFERENCES */
const WATCHER_HTML_MODERN = ` <span class="font-small">[<i>Watches You</i>]</span>`
const WATCHER_HTML_CLASSIC = ` [<i>Watches You</i>]`
const MINUTES_BETWEEN_UPDATE = 5

/* DO NOT MODIFY THESE CONSTANTS */
const MILLISECONDS_PER_MINUTE = 1000*60

/**
 * @param username The username
 * @returns Whether it has been more than MINUTES_BETWEEN_UPDATE minutes since we last retrieved
 *          the user's watchlist from the site and saved it into local storage.
 */
async function shouldUpdate(username: string): Promise<boolean> {
    if (username != await GM_getValue('username', "")) {
        console.log(`Setting user for the first time!`)
        setUser(username)
        return true
    }
    const now = new Date
    const then = new Date(await GM_getValue('timeLastUpdated', now.getTime()))
    const minuteDiff = (now.getTime() - then.getTime()) / MILLISECONDS_PER_MINUTE
    console.log(`Last updated: ${then} (${minuteDiff} minutes ago)`)
    return minuteDiff > MINUTES_BETWEEN_UPDATE
}

/**
 * Extracts a username from a link such as "/user/raptor4694/"
 * @param link The link
 */
function getUsernameFromRelativeLink(link: string): string {
    const match = /\/user\/([-a-z0-9]+)\/?/g.exec(link)
    if (match == null) return null
    return match[1]
}

/**
 * Extracts a username from an HTMLElement's 'href' attribute
 * @param element The element
 */
function getUsernameFromHref(element: HTMLElement | null): string|null {
    let href = element?.getAttribute('href')
    if (href == null) return null
    return getUsernameFromRelativeLink(href)
}

/**
 * @returns The currently logged in user's username or null.
 */
function getUsername(): string {
    let username = getUsernameFromHref($(`a#my-username[href^="/user/"]`).get(0))
    if (username) setUser(username)
    return username
}

/**
 * Saves the username in local storage
 * @param username The username
 */
function setUser(username: string): Promise<string> {
    console.log(`Setting user: '${username}'`)
    return GM_setValue('username', username)
}

/**
 * Actually performs a request to retrieve the user's watchlist
 * @param username The username to retrieve the watchlist of
 */
async function retrieveUserWatchList(username: string): Promise<string[]> {
    async function actuallyRetrieveWatchlist(url: string): Promise<string[]> {
        const data = await $.get(url)
        let items = $(data).find(`a[href^="/user/"]`)
        let usernames: string[] = new Array<string>(items.length)
        for (let i = 0; i < items.length; i++) {
            usernames[i] = getUsernameFromHref(items.get(i))
        }
        return usernames    
    }
    
    let usernames = await actuallyRetrieveWatchlist(`/watchlist/to/${username}/`)
    
    let i = 2
    do {
        var moreUsernames = await actuallyRetrieveWatchlist(`/watchlist/to/${username}/${i}/`)
        usernames.push(...moreUsernames)
        i++
    } while (moreUsernames.length !== 0)

    await GM_setValue('timeLastUpdated', Date.now())
    await GM_setValue('usernames', usernames.join(','))
    console.log(`Updated locally-saved user watchlist (${usernames.length} entries)`)
    return usernames
}

/**
 * Gets a user's watchlist
 * @param username The username to retrieve the watchlist of
 */
async function getUserWatchList(username: string): Promise<string[]> {
    let usernames: string[]
    if (await shouldUpdate(username)) {
        usernames = await retrieveUserWatchList(username)
    } else {
        let usernames_str = await GM_getValue('usernames', "")
        if (usernames_str.length === 0) {
            usernames = await retrieveUserWatchList(username)
        } else {
            usernames = usernames_str.split(',')
        }
    }
    return usernames
}

// Main Procedure
const isClassic = document.body.getAttribute('data-static-path') == "/themes/classic"
console.log(`${isClassic? "Classic" : "Modern"} theme detected!`)

const page = document.URL.substring(document.URL.indexOf("furaffinity.net/") + 16)

const isUserpage = page.startsWith("user/")
if (isUserpage) console.log(`Userpage detected!`)

const isJournal = page.startsWith("journal/")
if (isJournal) console.log(`Journal detected!`)

const isNote = page.startsWith("msg/pms/")
if (isNote) console.log(`Note detected!`)

const USERNAME = getUsername()

if (USERNAME == null) {
    console.log(`Couldn't retrieve username!`)
} else if (isClassic) {
    getUserWatchList(USERNAME).then((following_users) => {
        console.log(`There are ${following_users.length} users watching ${USERNAME}`)

        function isWatcher(username: string): boolean {
            return $.inArray(username, following_users) !== -1
        }

        // comments
        if (!(isUserpage || isNote))
        $(`.container-comment`).each(function() {
            const username = getUsernameFromHref($(this).find(`a[href^="/user/"]`).get(0))
            console.log(`Comment poster: '${username}'`)
            if (isWatcher(username)) {
                $(this).find(`.replyto-name`).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // shouts
        if (isUserpage)
        $(`table#page-userpage>tbody>tr:nth-child(2)>td:nth-child(2)>table[id^="shout-"] div.from-header>a[href^="/user/"]`).each(function() {
            const username = getUsernameFromHref(this)
            console.log(`Comment poster: '${username}'`)
            if (isWatcher(username)) {
                $(this).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // page owner
        if (isUserpage)
        $(`td.cat tbody>tr>td.addpad.lead`).each(function() {
            const username = /\bfuraffinity\.net\/user\/([-a-z0-9]+)(\/.*)?$/.exec(document.URL)[1]
            console.log(`Page owner: '${username}'`)
            if (isWatcher(username)) {
                $(this).find(`br:last-child`).before(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // submission owner
        if (!(isUserpage || isNote))
        $(`.classic-submission-title.information>a[href^="/user/"]`).each(function() {
            const username = getUsernameFromHref(this)
            console.log(`Submission owner: '${username}'`)
            if (isWatcher(username)) {
                $(this).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // journal owner
        if (isJournal)
        $(`.journal-title-box>a[href^="/user/"]`).each(function() {
            const username = getUsernameFromHref(this)
            console.log(`Journal poster: '${username}'`)
            if (isWatcher(username)) {
                $(this).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // note sender
        if (isNote)
        $(`.note-view-container .alt1.head>.title~em>a[href^="/user/"]`).each(function() {
            const username = getUsernameFromHref(this)
            console.log(`Note sender: '${username}'`)
            if (isWatcher(username)) {
                $(this).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

    })
} else /* modern theme */ {
    getUserWatchList(USERNAME).then((following_users) => {
        console.log(`There are ${following_users.length} users watching ${USERNAME}`)

        function isWatcher(username: string): boolean {
            return $.inArray(username, following_users) !== -1
        }

        // comments/shouts
        if (!isNote)
        $(`.comment_container`).each(function() {
            const username = getUsernameFromHref($(this).find(`.comment_anchor~div>a[href^="/user/"]`).get(0))
            console.log(`Comment poster: '${username}'`)
            if (isWatcher(username)) {
                $(this).find(isUserpage? `.comment_username` : `.cell>a.inline+span`).after(WATCHER_HTML_MODERN)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // page/journal owner
        if (isUserpage || isJournal)
        $(`.user-profile-main`).each(function() {
            const username = getUsernameFromHref($(this).find(`.user-nav-avatar-desktop>a[href^="/user/"]`).get(0))
            console.log(`${isUserpage? 'Page owner' : 'Journal poster'}: '${username}'`)
            if (isWatcher(username)) {
                $(this).find(`.username span[title]`).after(WATCHER_HTML_MODERN)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // submission owner
        if (!(isUserpage || isJournal))
        $(`.submission-id-sub-container`).each(function() {
            const username = getUsernameFromHref($(this).find(`a[href^="/user/"]`).get(0))
            console.log(`Submission owner: '${username}'`)
            if (isWatcher(username)) {
                $(this).append(WATCHER_HTML_MODERN)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

        // note sender
        if (isNote)
        $(`#message .message-center-note-information.addresses>a[href^="/user/"]`).first().each(function() {
            const username = getUsernameFromHref(this)
            console.log(`Note sender: '${username}'`)
            if (isWatcher(username)) {
                $(this).after(WATCHER_HTML_CLASSIC)
                console.log(`=> watches you`)
            } else {
                console.log(`=> does not watch you`)
            }
        })

    })
}