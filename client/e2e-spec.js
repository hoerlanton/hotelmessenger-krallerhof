'use strict'; // necessary for es6 output in node
var protractor_1 = require('protractor');
describe('cli-quickstart App', function () {
    beforeEach(function () {
        return protractor_1.browser.get('/');
    });
    it('should display message saying app works', function () {
        var pageTitle = protractor_1.element(protractor_1.by.css('app-root h1')).getText();
        expect(pageTitle).toEqual('My First Angular App');
    });
});
