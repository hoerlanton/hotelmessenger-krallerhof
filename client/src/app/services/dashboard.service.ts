import { Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import 'rxjs/add/operator/map';

@Injectable()
export class DashboardService {
    constructor(private http: Http) {
        console.log('Task service initialized!');
    }
    getGuests() {
        return this.http.get('guests')
            .map(res => res.json());
    }
    getMessages() {
        return this.http.get('guestsMessages')
            .map(res => res.json());
    }
    getScheduledMessages() {
        return this.http.get('guestsScheduledMessages')
            .map(res => res.json());
    }



    sendMessage(newMessage) {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log(headers);
        return this.http.post('guestsMessage', newMessage, {headers: headers} )
            .map(res => res.json());
    }

    scheduleMessage(scheduledMessage) {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log(headers);
        return this.http.post('guestsMessage', scheduledMessage, {headers: headers} )
            .map(res => res.json());
    }
}