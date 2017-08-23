import { Component } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { Guest } from '../../../../Guest';
import { Messages } from '../../../../Messages';
import { Http } from '@angular/http';
import { OnInit } from '@angular/core';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import { FlashMessagesService } from 'angular2-flash-messages';

@Component({
    selector: 'dashboard',
    templateUrl: 'dashboard.component.html',
    styleUrls: ['dashboard.component.css'],
})

export class DashboardComponent implements OnInit {
    guests: Guest[];
    sentMessages: Messages[];
    title: string;
    dateGenerated: any;
    filesToUpload: Array<File> = [];
    scheduledDate: Date = new Date(2017, 1, 1);
    scheduledMessages: Messages[];
    datepickerOpts = {
        startDate: new Date(2017, 1, 1),
        autoclose: true,
        todayBtn: 'linked',
        todayHighlight: true,
        assumeNearbyYear: true,
        format: 'D, d MM yyyy'
    };


    constructor(private dashboardService: DashboardService, private http: Http, private _flashMessagesService: FlashMessagesService) {
        this.dashboardService.getGuests()
            .subscribe(guests => {
                this.guests = guests;
            });

        this.dashboardService.getMessages()
            .subscribe(sentMessages => {
                this.sentMessages = sentMessages;
            });

        this.dashboardService.getScheduledMessages()
            .subscribe(scheduledMessages => {
                this.scheduledMessages = scheduledMessages;
            });
    }



    clicked(event) {
        console.log(this.scheduledDate);
        let scheduledMessage = {
            text: this.title,
            date: this.scheduledDate.toString(),
        };
        if (scheduledMessage.text === undefined) {
            this._flashMessagesService.show('Die Nachricht ist leer ... ',
                { cssClass: 'alert-danger', timeout: 20000 });
            return;
        }
        console.log(scheduledMessage);

        this.dashboardService.scheduleMessage(scheduledMessage)
            .subscribe(Messages => {
                this.scheduledMessages.push(Messages);
                this.title = '';
            });
    }

    sendMessage(event) {
        event.preventDefault();
        this.dateGenerated = new Date();
        let newMessage = {
            text: this.title,
            date: this.dateGenerated
        };
        if (newMessage.text === undefined) {
            this._flashMessagesService.show('Die Nachricht ist leer ... ',
                { cssClass: 'alert-danger', timeout: 20000 });
            return;
        }
        console.log(newMessage);

        this.dashboardService.sendMessage(newMessage)
            .subscribe(Messages => {
                this.sentMessages.push(Messages);
                this.title = '';
            });
    }

    ngOnInit() {

    }

    upload() {
        const formData: any = new FormData();
        const files: Array<File> = this.filesToUpload;
        if (files[0] === undefined) {
            this._flashMessagesService.show('Es wurde keine Datei ausgewählt ... ',
                { cssClass: 'alert-danger', timeout: 20000 });
            return;
        }
        formData.append('uploads[]', files[0], files[0]['name']);
        console.log(formData);
        this.http.post('/upload', formData)
            .map(files => files.json()).map(res =>
            // 1st parameter is a flash message text
            // 2nd parameter is optional. You can pass object with options.
            this._flashMessagesService.show('Datei wurde angehängt und ist zum versenden bereit ... ',
                { cssClass: 'alert-success', timeout: 20000 }),
        )
            .subscribe(files => console.log('files', files));
    }

    fileChangeEvent(fileInput: any) {
        this.filesToUpload = <Array<File>>fileInput.target.files;
        //this.successMsg = "Hoi" + fileInput.target.files[0]['name'];
        //console.log(this.successMsg);
        //this.product.photo = fileInput.target.files[0]['name'];
    }
}


// html file deleted:
// {{"Kann zahlen: " + guest.is_payment_enabled}}