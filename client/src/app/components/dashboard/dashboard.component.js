"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var dashboard_service_1 = require("../../services/dashboard.service");
var http_1 = require("@angular/http");
require("rxjs/add/operator/map");
require("rxjs/add/operator/catch");
var angular2_flash_messages_1 = require("angular2-flash-messages");
var DashboardComponent = (function () {
    function DashboardComponent(dashboardService, http, _flashMessagesService) {
        var _this = this;
        this.dashboardService = dashboardService;
        this.http = http;
        this._flashMessagesService = _flashMessagesService;
        this.filesToUpload = [];
        this.scheduledDate = new Date(2016, 5, 10);
        this.datepickerOpts = {
            startDate: new Date(2016, 5, 10),
            autoclose: true,
            todayBtn: 'linked',
            todayHighlight: true,
            assumeNearbyYear: true,
            format: 'D, d MM yyyy'
        };
        this.dashboardService.getGuests()
            .subscribe(function (guests) {
            _this.guests = guests;
        });
        this.dashboardService.getMessages()
            .subscribe(function (sentMessages) {
            _this.sentMessages = sentMessages;
        });
        this.dashboardService.getScheduledMessages()
            .subscribe(function (scheduledMessages) {
            _this.scheduledMessages = scheduledMessages;
        });
    }
    DashboardComponent.prototype.clicked = function (event) {
        var _this = this;
        console.log(this.scheduledDate);
        var scheduledMessage = {
            text: this.title,
            date: this.scheduledDate.toString(),
        };
        console.log(scheduledMessage);
        this.dashboardService.scheduleMessage(scheduledMessage)
            .subscribe(function (Messages) {
            _this.scheduledMessages.push(Messages);
            _this.title = '';
        });
    };
    DashboardComponent.prototype.sendMessage = function (event) {
        var _this = this;
        event.preventDefault();
        this.dateGenerated = new Date();
        var newMessage = {
            text: this.title,
            date: this.dateGenerated
        };
        console.log(newMessage);
        this.dashboardService.sendMessage(newMessage)
            .subscribe(function (Messages) {
            _this.sentMessages.push(Messages);
            _this.title = '';
        });
    };
    DashboardComponent.prototype.ngOnInit = function () {
    };
    DashboardComponent.prototype.upload = function () {
        var _this = this;
        var formData = new FormData();
        var files = this.filesToUpload;
        formData.append('uploads[]', files[0], files[0]['name']);
        this.http.post('/upload', formData)
            .map(function (files) { return files.json(); }).map(function (res) {
            // 1st parameter is a flash message text
            // 2nd parameter is optional. You can pass object with options.
            return _this._flashMessagesService.show('Erfolgreich Datei angehängt', { cssClass: 'alert-success', timeout: 10000 });
        })
            .subscribe(function (files) { return console.log('files', files); });
    };
    DashboardComponent.prototype.fileChangeEvent = function (fileInput) {
        this.filesToUpload = fileInput.target.files;
        //this.successMsg = "Hoi" + fileInput.target.files[0]['name'];
        //console.log(this.successMsg);
        //this.product.photo = fileInput.target.files[0]['name'];
    };
    return DashboardComponent;
}());
DashboardComponent = __decorate([
    core_1.Component({
        selector: 'dashboard',
        templateUrl: 'dashboard.component.html',
        styleUrls: ['dashboard.component.css'],
    }),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService, http_1.Http, angular2_flash_messages_1.FlashMessagesService])
], DashboardComponent);
exports.DashboardComponent = DashboardComponent;
// html file deleted:
// {{"Kann zahlen: " + guest.is_payment_enabled}} 
//# sourceMappingURL=dashboard.component.js.map