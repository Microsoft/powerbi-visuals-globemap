/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
import * as _ from "lodash";
import * as $ from "jquery";

import {
    IGeocoder,
    ILocationDictionary
} from "./interfaces/geocoderInterfaces";
import {
    BingAddress,
    BingGeoboundary,
    BingLocation,
    BingGeocodeResponse,
    BingGeoboundaryResponse,
    BingGeoboundaryPrimitive,
    BingJobStatusResponse
} from "../interfaces/bingInterfaces";

import { BingSettings } from "../settings";

export const CategoryTypes = {
    Address: "Address",
    City: "City",
    Continent: "Continent",
    CountryRegion: "Country", // The text has to stay "Country" because it is used as a key in the geocoding caching dictionary
    County: "County",
    Longitude: "Longitude",
    Latitude: "Latitude",
    Place: "Place",
    PostalCode: "PostalCode",
    StateOrProvince: "StateOrProvince"
};

export function createGeocoder(): IGeocoder {
    return new DefaultGeocoder();
}

export abstract class BingMapsGeocoder implements IGeocoder {

    protected abstract bingSpatialDataFlowUrl(): string;

    private contentType: string;
    private inputType: string;
    private key: string;

    private static jsonpCallbackObjectName = "powerbi";
    private static requestTimeout = 2000;
    private static HttpStatuses = {
        OK: 200,
        CREATED: 201
    };
    private static JobStatuses = {
        COMPLETED: "Completed",
        ABORTED: "Aborted",
        PENDING: "Pending"
    };

    constructor() {
        this.contentType = "application/xml";
        this.inputType = "xml";
        this.key = BingSettings.BingKey;
    }

    private createXmlStringFromLocationQueries(queries: string[]): string {
        const xmlns: string = "http://schemas.microsoft.com/search/local/2010/5/geocode";
        const xmlStart: string = `<?xml version="1.0" encoding="utf-8"?>
            <GeocodeFeed xmlns="${xmlns}">`;
        const xmlEnd: string = `</GeocodeFeed>`;

        let entities: string = '';
        let cultureName: string = navigator["userLanguage"] || navigator["language"];
        cultureName = mapLocalesForBing(cultureName);
        for (let i = 0; i < queries.length; i++) {
            let entity: string = `
            <GeocodeEntity Id="${i + 1}" xmlns="${xmlns}">
                <GeocodeRequest Culture="${cultureName}" Query="${queries[i]}" MaxResults="1">
                </GeocodeRequest>
            </GeocodeEntity>`;
            entities += entity;
        }

        const result: string = xmlStart + entities + xmlEnd;
        return result;
    }

    public async geocodeByDataFlow(queries: string[]): Promise<ILocationDictionary> {
        let xmlString = this.createXmlStringFromLocationQueries(queries);

        return new Promise<ILocationDictionary>((resolve, reject) => {
            this.createJob(xmlString)
                .then((response) => {
                    if (!response.ok || response.status !== BingMapsGeocoder.HttpStatuses.CREATED) {
                        reject("Geocoder Job creation error");
                    }
                    // get ID from readable stream
                    response.json()
                        .then((body) => {
                            const jobID: string = body.resourceSets[0].resources[0].id;
                            // get job status
                            let taskStatus = BingMapsGeocoder.JobStatuses.PENDING;
                            const interval = setInterval(() => {
                                this.monitorJobStatusJsonp(jobID)
                                    .then((response: BingJobStatusResponse) => {
                                        if (response.statusCode === BingMapsGeocoder.HttpStatuses.OK) {
                                            taskStatus = response.resourceSets[0].resources[0].status;
                                            if (taskStatus === BingMapsGeocoder.JobStatuses.COMPLETED) {
                                                // get the job result in xml
                                                this.getJobResultJsonp(jobID)
                                                    .then((response: XMLDocument) => {
                                                        const locationDictionary: ILocationDictionary = this.parseXmlJobResult(response);
                                                        clearInterval(interval);
                                                        resolve(locationDictionary);
                                                    })
                                                    .catch(() => {
                                                        clearInterval(interval);
                                                        reject("Geocoder Job Result request has been failed");
                                                    });
                                            }

                                            if (taskStatus === BingMapsGeocoder.JobStatuses.ABORTED) {
                                                reject("Geocoder job was aborted due to an error");
                                                clearInterval(interval);
                                            }
                                        }
                                    })
                                    .catch(() => {
                                        clearInterval(interval);
                                        reject("Geocoder Job status request has been failed");
                                    });
                            }, BingMapsGeocoder.requestTimeout);
                        })
                        .catch(() => reject("Geocoder API response has been changed"));
                })
                .catch(() => reject("Geocoder error"));
        });
    }

    private async createJob(xmlInput): Promise<Response> {
        const queryString = `input=${this.inputType}&key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}?${queryString}`;

        // output - json as default; xml
        return fetch(url,
            {
                headers: {
                    'Accept': this.contentType,
                    'Content-Type': this.contentType
                },
                method: "POST",
                body: xmlInput
            });
    }

    private async getJobResultJsonp(jobID): Promise<XMLDocument> {
        const queryString = `key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}/${jobID}/output/succeeded/?${queryString}`;

        const callbackGuid: string = BingMapsGeocoder.generateCallbackGuid();

        // This is super dirty hack to bypass faked window object in order to use jsonp
        // We use jsonp because sandboxed iframe does not have an origin. This fact breaks regular AJAX queries.
        window[BingMapsGeocoder.jsonpCallbackObjectName][callbackGuid] = (data) => {
            delete window[BingMapsGeocoder.jsonpCallbackObjectName][callbackGuid];
        };

        // output - json as default; xml
        return $.ajax({
            url: url,
            dataType: 'xml',
            crossDomain: true,
            jsonp: "jsonp",
            jsonpCallback: `window.${BingMapsGeocoder.jsonpCallbackObjectName}.${callbackGuid}`
        }).promise();
    }

    private async monitorJobStatusJsonp(jobID: string): Promise<BingJobStatusResponse> {
        const queryString = `key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}/${jobID}?${queryString}`;

        const callbackGuid: string = BingMapsGeocoder.generateCallbackGuid();

        // This is super dirty hack to bypass faked window object in order to use jsonp
        // We use jsonp because sandboxed iframe does not have an origin. This fact breaks regular AJAX queries.
        window[BingMapsGeocoder.jsonpCallbackObjectName][callbackGuid] = (data) => {
            delete window[BingMapsGeocoder.jsonpCallbackObjectName][callbackGuid];
        };

        return $.ajax({
            url: url,
            dataType: 'json',
            crossDomain: true,
            jsonp: "jsonp",
            jsonpCallback: `window.${BingMapsGeocoder.jsonpCallbackObjectName}.${callbackGuid}`
        }).promise();
    }

    private static generateCallbackGuid(): string {
        let cryptoObj = window.crypto || window["msCrypto"]; // For IE
        const guidSequence: number = cryptoObj.getRandomValues(new Uint32Array(1))[0].toString(16).substring(0, 4);

        return `GeocodeCallback${guidSequence}${guidSequence}${guidSequence}`;
    }

    private parseXmlJobResult(xmlDocument: XMLDocument): ILocationDictionary {
        let result: ILocationDictionary = {};
        let entities = xmlDocument.getElementsByTagName("GeocodeEntity");
        for (let i = 0; i < entities.length; i++) {
            const currentEntity = entities[i];
            const geocodeRequest = currentEntity.getElementsByTagName("GeocodeRequest");
            const geocodeResponse = currentEntity.getElementsByTagName("GeocodeResponse");
            const query: string = geocodeRequest.item(0).getAttribute("Query");
            const statusCode: string = geocodeResponse.item(0).getAttribute("StatusCode");

            if (statusCode === "Success") {
                const longitude: number = Number(geocodeResponse[0].children[1].getAttribute("Longitude"));
                const latitude: number = Number(geocodeResponse[0].children[1].getAttribute("Latitude"));
                result[query] = {
                    latitude,
                    longitude
                };
            }
        }

        return result;
    }
}

export class DefaultGeocoder extends BingMapsGeocoder {
    protected bingSpatialDataFlowUrl(): string {
        return 'https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode';
    }
}

/** Note: Used for test mockup */
// export let BingAjaxCall: BingAjaxService = $.ajax;
export const CategoryTypeArray = [
    "Address",
    "City",
    "Continent",
    "Country",
    "County",
    "Longitude",
    "Latitude",
    "Place",
    "PostalCode",
    "StateOrProvince"
];

export function isCategoryType(value: string): boolean {
    return CategoryTypeArray.indexOf(value) > -1;
}

/**
 * Map locales that cause failures to similar locales that work
 */
function mapLocalesForBing(locale: string): string {
    switch (locale.toLowerCase()) {
        case 'fr': // Bing gives a 404 error when this language code is used (fr is only obtained from Chrome).  Use fr-FR for a near-identical version that works. Defect # 255717 opened with Bing.
            return 'fr-FR';
        case 'de':
            return 'de-DE';
        default:
            return locale;
    }
}
