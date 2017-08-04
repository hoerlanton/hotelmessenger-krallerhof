"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var platform_browser_1 = require("@angular/platform-browser");
var core_1 = require("@angular/core");
var forms_1 = require("@angular/forms");
var http_1 = require("@angular/http");
var app_component_1 = require("./app.component");
var dashboard_component_1 = require("./components/dashboard/dashboard.component");
var angular2_flash_messages_1 = require("angular2-flash-messages");
var angular2_moment_1 = require("angular2-moment");
var ng2_datetime_1 = require("ng2-datetime/ng2-datetime");
require("@angular/platform-browser");
require("@angular/platform-browser-dynamic");
require("@angular/core");
require("@angular/common");
require("rxjs");
require("../../bower_components/bootstrap/dist/css/bootstrap.css");
require("../../bower_components/jquery/dist/jquery.min.js");
require("../../bower_components/bootstrap-datepicker/dist/css/bootstrap-datepicker3.min.css");
require("../../bower_components/bootstrap-datepicker/dist/js/bootstrap-datepicker.min.js");
require("../../node_modules/bootstrap-timepicker/css/bootstrap-timepicker.min.css");
require("../../node_modules/bootstrap-timepicker/js/bootstrap-timepicker.min.js");
var AppModule = (function () {
    function AppModule() {
    }
    return AppModule;
}());
AppModule = __decorate([
    core_1.NgModule({
        declarations: [
            app_component_1.AppComponent, dashboard_component_1.DashboardComponent
        ],
        imports: [
            ng2_datetime_1.NKDatetimeModule,
            platform_browser_1.BrowserModule,
            forms_1.FormsModule,
            http_1.HttpModule,
            angular2_flash_messages_1.FlashMessagesModule,
            angular2_moment_1.MomentModule
        ],
        providers: [],
        bootstrap: [app_component_1.AppComponent]
    })
], AppModule);
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map