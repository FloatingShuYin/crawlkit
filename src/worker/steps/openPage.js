'use strict'; // eslint-disable-line

const urijs = require('urijs');
const path = require('path');
const applyUrlFilterFn = require(path.join(__dirname, '..', '..', 'applyUrlFilterFn.js'));
const errors = require(path.join(__dirname, '..', '..', 'errors.js'));
const once = require('once');

module.exports = (scope, logger, addUrl, followRedirects, redirectFilter) => {
    return (cb) => {
        logger.debug('Opening page.');
        const done = once(cb);

        logger.debug('Setting onNavigationRequested');
        scope.page.onNavigationRequested = (redirectedToUrl, type, willNavigate, mainFrame) => {
            if (urijs(scope.url).equals(redirectedToUrl)) {
                // this is the initial open of the task URL, ignore
                return;
            }

            logger.debug(`Page for ${scope.url} asks for redirect. Will navigatate? ${willNavigate ? 'Yes' : 'No'}`);

            if (followRedirects) {
                if (mainFrame && type === 'Other') {
                    try {
                        const state = applyUrlFilterFn(redirectFilter, redirectedToUrl, scope.url, addUrl);
                        if (state === false) {
                            done(`URL ${redirectedToUrl} was not followed`, scope);
                        } else {
                            done(new errors.RedirectError('Redirected', redirectedToUrl), scope);
                        }
                    } catch (e) {
                        logger.debug(`Error on redirect filter (${redirectedToUrl}, ${scope.url})`);
                        done(e);
                    }
                }
            }
        };

        scope.page.onResourceReceived = (res) => {
            if (urijs(scope.url).equals(res.url) && parseInt(res.status, 10) >= 400) {
                // main page returned with a 4XX or higher
                done(new errors.StatusError(res.statusText, res.status));
                return;
            }
        };

        scope.page.open(scope.url, (err, status) => {
            if (err || status !== 'success') {
                logger.error('Something went wrong when opening the page');
                done(err || `Failed to open ${scope.url}`);
                return;
            }
            logger.debug(`Page opened`);
            done();
        });
    };
};