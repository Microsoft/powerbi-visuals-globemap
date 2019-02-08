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
import powerbi from "powerbi-visuals-api";
import * as _ from "lodash";
import * as $ from "jquery";
import * as fetchJsonp from "fetch-jsonp";

import IPromise = powerbi.IPromise;
import PrimitiveValue = powerbi.PrimitiveValue;

import {
    IGeocoder,
    IGeocodeResource,
    IGeocoderOptions,
    IGeocodeQuery,
    IGeocodeQueueItem,
    IGeocodeResult,
    IGeocodeBoundaryCoordinate,
    IGeocodeCoordinate,
    GeocodeOptions
} from "./interfaces/geocoderInterfaces";
import {
    BingAddress,
    BingGeoboundary,
    BingLocation,
    BingGeocodeResponse,
    BingGeoboundaryResponse,
    BingGeoboundaryPrimitive
} from "../interfaces/bingInterfaces";

import { UrlUtils } from "../UrlUtils/UrlUtils";
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

export enum JQueryPromiseState {
    pending,
    resolved,
    rejected,
}

export function createGeocoder(): IGeocoder {
    return new DefaultGeocoder();
}

export abstract class BingMapsGeocoder implements IGeocoder {

    protected abstract bingGeocodingUrl(): string;
    protected abstract bingSpatialDataUrl(): string;

    private contentType: string;
    private inputType: string;
    private coreKey: string;
    private key: string;

    constructor() {
        this.contentType = "application/xml";
        this.inputType = "xml";
        this.coreKey = "Agc-qH1P_amkhHFyqOlKpuPw4IH2P0A5DyuSqy6XL00aFYAaulS3xg_m5ZPcv3Cc";
        this.key = "YzyBFJgUrMNy4UEJWNpt~3ia-8PWaplOLtxqAWUD9dQ~As3csOrjB7b4KJ7cY6vkaSZsJT4FsKjE0rvTYJPZx-xaFSvB5IV0u3-KJnM0zNon";
    }

    private xmlInput = `<?xml version="1.0" encoding="utf-8"?>  
    <GeocodeFeed xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode" Version="2.0">  
      <GeocodeEntity Id="001" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode">  
        <GeocodeRequest Culture="en-US" IncludeNeighborhood="1">  
          <Address AddressLine="1 Microsoft Way" AdminDistrict="WA" Locality="Redmond" PostalCode="98052" />  
        </GeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="002" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode">  
        <GeocodeRequest IncludeNeighborhood="1" MaxResults="2" Query="Kings Road">  
          <ConfidenceFilter MinimumConfidence="Medium"/>  
        </GeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="003" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode">  
        <GeocodeRequest Culture="en-US" Query="Seattle Space Needle" IncludeNeighborhood="1" IncludeQueryParse="true" MaxResults="5" >  
        </GeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="004" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode">  
        <GeocodeRequest Culture="en-US" Query="">  
          <Address AddressLine="" AdminDistrict="" />  
        </GeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="005" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode">  
        <ReverseGeocodeRequest Culture="en-US" IncludeNeighborhood="1" MaxResults="5" IncludeEntityTypes="Neighborhood">  
          <Location Longitude="-122.11871" Latitude="47.673099"/>  
          <ConfidenceFilter MinimumConfidence="High"/>  
        </ReverseGeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="006" xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode" >  
        <ReverseGeocodeRequest Culture="en-ca">  
          <Location Longitude="-113.403092450204" Latitude="53.4802172766598"/>  
        </ReverseGeocodeRequest>  
      </GeocodeEntity>  
      <GeocodeEntity Id="007"  xmlns="http://schemas.microsoft.com/search/local/2010/5/geocode" >  
        <ReverseGeocodeRequest IncludeNeighborhood="1" MaxResults="5" IncludeEntityTypes="Neighborhood,PopulatedPlace">  
          <Location Longitude="-122.12934" Latitude="47.64054"/>  
        </ReverseGeocodeRequest>  
      </GeocodeEntity>  
    </GeocodeFeed>`;

    public geocode(geocodeParams: IGeocoderOptions): Promise<IGeocodeCoordinate> {
        return this.geocodeCore("geocode", new GeocodeQuery(this.bingGeocodingUrl(), this.bingSpatialDataUrl(), geocodeParams.query, geocodeParams.category), geocodeParams.options);
    }

    public geocodeBoundary(latitude: number, longitude: number, category: string = '', levelOfDetail: number = 2, maxGeoData: number = 3, options?: GeocodeOptions): Promise<IGeocodeBoundaryCoordinate | IGeocodeCoordinate> {
        return this.geocodeCore("geocodeBoundary", new GeocodeBoundaryQuery(this.bingGeocodingUrl(), this.bingSpatialDataUrl(), latitude, longitude, category, levelOfDetail, maxGeoData), options);
    }

    public geocodePoint(latitude: number, longitude: number, entities: string[], options?: GeocodeOptions): Promise<IGeocodeCoordinate | IGeocodeResource> {
        return this.geocodeCore("geocodePoint", new GeocodePointQuery(this.bingGeocodingUrl(), this.bingSpatialDataUrl(), latitude, longitude, entities), options);
    }

    private async createJob(xmlInput): Promise<Response> {
        const queryString = `input=${this.inputType}&key=${this.key}`;
        const url = `https://spatial.virtualearth.net/REST/v1/dataflows/geocode?${queryString}`;


        // output - json as default; xml
        return fetch(url,
            {
                headers: {
                    'Accept': this.contentType,
                    'Content-Type': this.contentType
                },
                method: "POST",
                body: xmlInput
            })

    }

    private async monitorJobStatus(jobID): Promise<Response> {
        const queryString = `output=json&key=${this.key}`;
        const url = `https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode/${jobID}?${queryString}`;


        // output - json as default; xml
        return fetch(url,
            {
                mode: 'no-cors',
                headers: new Headers([
                    //     ['Access-Control-Allow-Origin', '*'],
                    //     ['Access-Control-Allow-Headers', 'Content-Type'],
                    //     ['access-control-allow-methods', 'GET'],
                    ['content-type', "application/json; charset=UTF-8"],
                    //     ['content-location', `https://spatial.virtualearth.net/REST/v1/dataflows/Geocode/${jobID}`]
                ]),
                method: "GET"
            })

    }

    private async getJobResult(jobID): Promise<Response> {
        const queryString = `key=${this.key}`;
        const url = `https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode/${jobID}/output/succeeded/?${queryString}`;


        // output - json as default; xml
        return fetch(url,
            {
                mode: 'no-cors',
                headers: new Headers([
                    // ['Access-Control-Allow-Origin', '*'],
                    // ['Access-Control-Allow-Headers', 'Content-Type'],
                    // ['access-control-allow-methods', 'GET'],
                    ['Accept', "application/xml"],
                ]),
                method: "GET"
            })
    }

    private geocodeCore(queueName: string, geocodeQuery: IGeocodeQuery, options?: GeocodeOptions): Promise<IGeocodeCoordinate> {
        debugger;

        let job = "32b70f685d334adfb1c438fb29f1f16c";

        this.monitorJobStatus("32b70f685d334adfb1c438fb29f1f16c")
            .then(data => data.json())
            .then((data) => {
                console.log(data)
            })
            .catch(err => console.log(err));

        // this.getJobResult("32b70f685d334adfb1c438fb29f1f16c")
        //     .then(data => data.json())
        //     .then((data) => {
        //         console.log(data)
        //     })
        //     .catch(err => console.log(err));

        // this.createJob(this.xmlInput)
        //     .then(function (response) {
        //         console.log(response);
        //         const STATUS_CREATED = 201;
        //         if (!response.ok || response.status != STATUS_CREATED) {

        //             return Promise.reject("creation error");
        //         }
        //         // get ID from readable stream
        //         response.json()
        //             .then((body) => {
        //                 const jobID = body.resourceSets[0].resources[0].id;
        //                 console.log(jobID);

        //                 //get the job status
        //                 this.monitorJobStatus(jobID)
        //                     .then(response => response.text()
        //                         .then((data) => {
        //                             console.log(data);
        //                             // get the status - then get the job result
        //                             //get the job result
        //                             this.getJobResult(jobID)
        //                                 .then(response => response.text()
        //                                     .then((data) => {
        //                                         console.log(data)
        //                                     })
        //                                     .catch(error => console.log(error)))
        //                                 .catch(error => console.log('monitoring job failed : ' + error.message));
        //                         })
        //                         .catch(error => console.log(error)))
        //                     .catch(error => console.log('monitoring job failed : ' + error.message));
        //             })
        //             .catch(err => console.log(err));

        //     })
        //     .catch(function (response) { console.log(response) })

        //const jobID = "d3c903ab83d84f05a2158b084a761545";

        return new Promise<IGeocodeCoordinate>((resolve, reject) => {
            //     //const url = "https://dev.virtualearth.net/REST/v1/Locations?key=YzyBFJgUrMNy4UEJWNpt~3ia-8PWaplOLtxqAWUD9dQ~As3csOrjB7b4KJ7cY6vkaSZsJT4FsKjE0rvTYJPZx-xaFSvB5IV0u3-KJnM0zNon&q=albuquerque, new mexico&c=ru-RU&maxRes=20";
            const queryString = `key=${this.key}`;
            const url = `https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode/${job}?${queryString}`;
            //     const url = `https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode/${jobID}/output/succeeded/?${queryString}`;

            let guidSequence = () => {
                let cryptoObj = window.crypto || window["msCrypto"]; // For IE

                return cryptoObj.getRandomValues(new Uint32Array(1))[0].toString(16).substring(0, 4);
            };

            const callbackGuid: string = `GeocodeCallback${guidSequence()}${guidSequence()}${guidSequence()}`;

            // This is super dirty hack to bypass faked window object in order to use jsonp
            // We use jsonp because sandboxed iframe does not have an origin. This fact breaks regular AJAX queries.
            const callbackObjectName = "powerbi";
            window[callbackObjectName][callbackGuid] = (data) => {
                debugger;

                delete window[callbackObjectName][callbackGuid];
            };


            // fetchJsonp(url, {
            //     jsonpCallback: `window.${callbackObjectName}.${callbackGuid}`,

            // })
            //     .then((response) => {
            //         debugger;
            //         console.log(response);
            //     })
            //     .catch((error) => {
            //         console.log(error);
            //         debugger;
            //     });

            // $.ajax({
            //     url: url,
            //     dataType: 'xml',
            //     crossDomain: true,
            //     jsonp: "jsonp",
            //     jsonpCallback: `window.${callbackObjectName}.${callbackGuid}`
            // })
            //     .then((response) => {
            //         debugger;
            //         console.log(response);
            //     })
            //     .fail((error) => {
            //         console.log(error);
            //         debugger;
            //     });

        });
        // let deferred: JQueryDeferred<IGeocodeCoordinate> = $.Deferred();
        // let item: IGeocodeQueueItem = { query: geocodeQuery, deferred: deferred };

        // GeocodeQueueManager.enqueue(queueName, item);

        // if (options && options.timeout) {
        //     options.timeout.finally(() => {
        //         if (item.promise.pending()) {
        //             item.promise.reject();
        //         }
        //     });
        // }

        // return item.promise;
    }
}

export class DefaultGeocoder extends BingMapsGeocoder {
    protected bingSpatialDataUrl(): string {
        return 'https://platform.bing.com/geo/spatial/v1/public/Geodata';
    }

    protected bingGeocodingUrl(): string {
        return 'https://dev.virtualearth.net/REST/v1/Locations';
    }
}

export interface BingAjaxRequest {
    abort: () => void;
    always: (callback: () => void) => void;
    then: (successFn: (data: {}) => void, errorFn: (error: { statusText: string }) => void) => void;
}

export interface BingAjaxService {
    (url: string, settings: JQueryAjaxSettings): BingAjaxRequest;
}
export const safeCharacters: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

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

export const BingEntities = {
    Continent: "Continent",
    Sovereign: "Sovereign",
    CountryRegion: "CountryRegion",
    AdminDivision1: "AdminDivision1",
    AdminDivision2: "AdminDivision2",
    PopulatedPlace: "PopulatedPlace",
    Postcode: "Postcode",
    Postcode1: "Postcode1",
    Neighborhood: "Neighborhood",
    Address: "Address",
};

// Static variables for caching, maps, etc.
let categoryToBingEntity: { [key: string]: string; };
let categoryToBingEntityGeodata: { [key: string]: string; };

export class GeocodeQueryBase {
    public query: string;
    public category: string;
    public key: string;

    protected bingSpatialDataUrl: string;
    protected bingGeocodingUrl: string;

    constructor(bingGeocodingUrl: string, bingSpatialDataUrl: string, query: string, category: string) {
        this.bingGeocodingUrl = bingGeocodingUrl;
        this.bingSpatialDataUrl = bingSpatialDataUrl;
        this.query = query != null ? !(/[<()>#@!$%&*\^`'"/+:]/).test(query) && !(/(javascript:|data:)/i).test(query) ? query : "" : "";
        this.category = category != null ? category : "";
        this.key = (`G:${this.bingGeocodingUrl}; S:${this.bingSpatialDataUrl};${this.query}/${this.category}`).toLowerCase();
    }

    public getKey(): string {
        return this.key;
    }
}

export class GeocodeQuery extends GeocodeQueryBase implements IGeocodeQuery {
    constructor(bingGeocodingUrl: string, bingSpatialDataUrl: string, query: string, category: string) {
        super(bingGeocodingUrl, bingSpatialDataUrl, query, category);
    }

    public getBingEntity(): string {
        let category: string = this.category.toLowerCase();
        if (!categoryToBingEntity) {
            categoryToBingEntity = {};
            categoryToBingEntity[CategoryTypes.Continent.toLowerCase()] = BingEntities.Continent;
            categoryToBingEntity[CategoryTypes.CountryRegion.toLowerCase()] = BingEntities.Sovereign;
            categoryToBingEntity[CategoryTypes.StateOrProvince.toLowerCase()] = BingEntities.AdminDivision1;
            categoryToBingEntity[CategoryTypes.County.toLowerCase()] = BingEntities.AdminDivision2;
            categoryToBingEntity[CategoryTypes.City.toLowerCase()] = BingEntities.PopulatedPlace;
            categoryToBingEntity[CategoryTypes.PostalCode.toLowerCase()] = BingEntities.Postcode;
            categoryToBingEntity[CategoryTypes.Address.toLowerCase()] = BingEntities.Address;
        }
        return categoryToBingEntity[category] || "";
    }

    public getUrl(): string {
        let parameters: _.Dictionary<string> = {
            key: BingSettings.BingKey,
        };

        let entityType: string = this.getBingEntity();
        let queryAdded: boolean = false;
        if (entityType) {
            if (entityType === BingEntities.Postcode) {
                parameters["includeEntityTypes"] = "Postcode,Postcode1,Postcode2,Postcode3,Postcode4";
            }
            else if (this.query.indexOf(",") === -1 && (entityType === BingEntities.AdminDivision1 || entityType === BingEntities.AdminDivision2)) {
                queryAdded = true;
                try {
                    parameters["adminDistrict"] = decodeURIComponent(this.query);
                } catch (e) {
                    return null;
                }
            }
            else {
                parameters["includeEntityTypes"] = entityType;

                if (this.query.length === 2 && entityType === BingEntities.Sovereign) {
                    queryAdded = true;
                    try {
                        parameters["countryRegion"] = decodeURIComponent(this.query);
                    } catch (e) {
                        return null;
                    }
                }
            }
        }

        if (!queryAdded) {
            try {
                parameters["q"] = decodeURIComponent(this.query);
            } catch (e) {
                return null;
            }
        }

        let cultureName: string = navigator["userLanguage"] || navigator["language"];
        cultureName = mapLocalesForBing(cultureName);
        if (cultureName) {
            parameters["c"] = cultureName;
        }
        parameters["maxRes"] = "20";
        // If the query is of length 2, request the ISO 2-letter country code to be returned with the result to be compared against the query so that such results can be preferred.
        if (this.query.length === 2 && this.category === CategoryTypes.CountryRegion) {
            parameters["include"] = "ciso2";
        }

        return UrlUtils.setQueryParameters(this.bingGeocodingUrl, parameters, /*keepExisting*/true);
    }

    public getResult(data: BingGeocodeResponse): IGeocodeResult {
        let location: BingLocation = getBestLocation(data, location => this.locationQuality(location));
        if (location) {
            let pointData: number[] = location.point.coordinates;
            let coordinates: IGeocodeCoordinate = {
                latitude: pointData && pointData[0],
                longitude: pointData && pointData[1]
            };

            return { coordinates: coordinates };
        }

        return { error: new Error("Geocode result is empty.") };
    }

    private locationQuality(location: BingLocation): number {
        let quality: number = 0;

        // two letter ISO country query is most important
        if (this.category === CategoryTypes.CountryRegion) {
            let iso2: string = location.address && location.address.countryRegionIso2;
            if (iso2) {
                let queryString: string = this.query.toLowerCase();
                if (queryString.length === 2 && queryString === iso2.toLowerCase()) {
                    quality += 2;
                }
            }
        }

        // matching the entity type is also important
        if (location.entityType && location.entityType.toLowerCase() === this.getBingEntity().toLowerCase()) {
            quality += 1;
        }

        return quality;
    }
}

// Double check this function
function getBestLocation(data: BingGeocodeResponse, quality: (location: BingLocation) => number): BingLocation {
    let resources: BingLocation[] = data && !_.isEmpty(data.resourceSets) && data.resourceSets[0].resources;
    if (Array.isArray(resources)) {
        let bestLocation = resources.map(location => ({ location: location, value: quality(location) }));

        return _.maxBy(bestLocation, (locationValue) => locationValue.value).location;
    }
}

export class GeocodePointQuery extends GeocodeQueryBase implements IGeocodeQuery {
    public latitude: number;
    public longitude: number;
    public entities: string[];

    constructor(bingGeocodingUrl: string, bingSpatialDataUrl: string, latitude: number, longitude: number, entities: string[]) {
        super(bingGeocodingUrl, bingSpatialDataUrl, [latitude, longitude].join(), "Point");
        this.latitude = latitude;
        this.longitude = longitude;
        this.entities = entities;
    }

    // Point queries are used for user real-time location data so do not cache
    public getKey(): string {
        return null;
    }

    public getUrl(): string {
        let urlAndQuery = UrlUtils.splitUrlAndQuery(this.bingGeocodingUrl);

        // add backlash if it's missing
        let url = !_.endsWith(urlAndQuery.baseUrl, '/') ? `${urlAndQuery.baseUrl}/` : urlAndQuery.baseUrl;

        url += [this.latitude, this.longitude].join();

        let parameters: _.Dictionary<string> = {
            key: BingSettings.BingKey,
            include: 'ciso2'
        };

        if (!_.isEmpty(this.entities)) {
            parameters['includeEntityTypes'] = this.entities.join();
        }

        return UrlUtils.setQueryParameters(url, parameters, /*keepExisting*/true);
    }

    public getResult(data: BingGeocodeResponse): IGeocodeResult {
        let location: BingLocation = getBestLocation(data, location => this.entities.indexOf(location.entityType) === -1 ? 0 : 1);
        if (location) {
            let pointData: number[] = location.point.coordinates;
            let addressData: BingAddress = location.address || {};
            let name: string = location.name;
            let coordinates: IGeocodeResource = {
                latitude: pointData[0],
                longitude: pointData[1],
                addressLine: addressData.addressLine,
                locality: addressData.locality,
                neighborhood: addressData.neighborhood,
                adminDistrict: addressData.adminDistrict,
                adminDistrict2: addressData.adminDistrict2,
                formattedAddress: addressData.formattedAddress,
                postalCode: addressData.postalCode,
                countryRegionIso2: addressData.countryRegionIso2,
                countryRegion: addressData.countryRegion,
                landmark: addressData.landmark,
                name: name,
            };
            return { coordinates: coordinates };
        }

        return { error: new Error("Geocode result is empty.") };
    }
}

export class GeocodeBoundaryQuery extends GeocodeQueryBase implements IGeocodeQuery {
    public latitude: number;
    public longitude: number;
    public levelOfDetail: number;
    public maxGeoData: number;

    constructor(bingGeocodingUrl: string, bingSpatialDataUrl: string, latitude: number, longitude: number, category: string, levelOfDetail: number, maxGeoData: number = 3) {
        super(bingGeocodingUrl, bingSpatialDataUrl, [latitude, longitude, levelOfDetail, maxGeoData].join(","), category);
        this.latitude = latitude;
        this.longitude = longitude;
        this.levelOfDetail = levelOfDetail;
        this.maxGeoData = maxGeoData;
    }

    public getBingEntity(): string {
        let category = this.category.toLowerCase();
        if (!categoryToBingEntityGeodata) {
            categoryToBingEntityGeodata = {};
            categoryToBingEntityGeodata[CategoryTypes.CountryRegion.toLowerCase()] = BingEntities.CountryRegion;
            categoryToBingEntityGeodata[CategoryTypes.StateOrProvince.toLowerCase()] = BingEntities.AdminDivision1;
            categoryToBingEntityGeodata[CategoryTypes.County.toLowerCase()] = BingEntities.AdminDivision2;
            categoryToBingEntityGeodata[CategoryTypes.City.toLowerCase()] = BingEntities.PopulatedPlace;
            categoryToBingEntityGeodata[CategoryTypes.PostalCode.toLowerCase()] = BingEntities.Postcode1;
        }
        return categoryToBingEntityGeodata[category] || "";
    }

    public getUrl(): string {
        let parameters: _.Dictionary<string> = {
            key: BingSettings.BingKey,
            $format: "json",
        };

        let entityType: string = this.getBingEntity();

        if (!entityType) {
            return null;
        }

        let cultureName: string = navigator["userLanguage"] || navigator["language"];
        cultureName = mapLocalesForBing(cultureName);
        let cultures: string[] = cultureName.split("-");
        let data: PrimitiveValue[] = [this.latitude, this.longitude, this.levelOfDetail, `'${entityType}'`, 1, 0, `'${cultureName}'`];
        if (cultures.length > 1) {
            data.push(`'${cultures[1]}'`);
        }
        parameters["SpatialFilter"] = `GetBoundary(${data.join(", ")})`;
        return UrlUtils.setQueryParameters(this.bingSpatialDataUrl, parameters, /*keepExisting*/true);
    }

    public getResult(data: BingGeoboundaryResponse): IGeocodeResult {
        let result: BingGeoboundaryResponse = data;
        if (result && result.d && Array.isArray(result.d.results) && result.d.results.length > 0) {
            let entity: BingGeoboundary = result.d.results[0];
            let primitives: BingGeoboundaryPrimitive[] = entity.Primitives;
            if (primitives && primitives.length > 0) {
                let coordinates: IGeocodeBoundaryCoordinate = {
                    latitude: this.latitude,
                    longitude: this.longitude,
                    locations: []
                };

                primitives.sort((a, b) => {
                    if (a.Shape.length < b.Shape.length) {
                        return 1;
                    }
                    if (a.Shape.length > b.Shape.length) {
                        return -1;
                    }
                    return 0;
                });

                let maxGeoData: number = Math.min(primitives.length, this.maxGeoData);

                for (let i = 0; i < maxGeoData; i++) {
                    let ringStr: string = primitives[i].Shape;
                    let ringArray: string[] = ringStr.split(",");

                    for (let j: number = 1; j < ringArray.length; j++) {
                        coordinates.locations.push({ nativeBing: ringArray[j] });
                    }
                }

                return { coordinates: coordinates };
            }
        }

        return { error: new Error("Geocode result is empty.") };
    }
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

namespace GeocodeQueueManager {
    let queues: _.Dictionary<GeocodeQueue> = {};

    function ensureQueue(queueName: string): GeocodeQueue {
        let queue: GeocodeQueue = queues[queueName];
        if (!queue) {
            queues[queueName] = queue = new GeocodeQueue();
        }
        return queue;
    }

    export function enqueue(queueName: string, item: IGeocodeQueueItem): void {
        ensureQueue(queueName).enqueue(item);
    }

    export function reset(): void {
        for (let queueName in queues) {
            queues[queueName].reset();
        }

        queues = {};
    }
}

interface GeocodeQueueEntry {
    item: IGeocodeQueueItem;
    request?: BingAjaxRequest;
    jsonp?: boolean;            // remember because JSONP requests can't be aborted
    isCompleted?: boolean;
}

export class GeocodeQueue {
    private callbackObjectName: string = "powerbi";

    private entries: GeocodeQueueEntry[] = [];
    private activeEntries: GeocodeQueueEntry[] = [];
    private dequeueTimeout: number;

    public reset(): void {
        let timeout: number = this.dequeueTimeout;
        if (timeout) {
            this.dequeueTimeout = undefined;
            clearTimeout(timeout);
        }

        for (let entry of this.entries.concat(this.activeEntries)) {
            this.cancel(entry);
        }

        this.entries = [];
        this.activeEntries = [];
    }

    public enqueue(item: IGeocodeQueueItem): void {
        let entry: GeocodeQueueEntry = { item: item };
        this.entries.push(entry);

        item.promise.finally(() => {
            this.cancel(entry);
        });

        this.dequeue();
    }

    private inDequeue = false;

    private dequeue(): void {
        if (this.inDequeue || this.dequeueTimeout) {
            return;
        }

        try {
            this.inDequeue = true;
            while (this.entries.length !== 0 && this.activeEntries.length < BingSettings.MaxBingRequest) {
                let entry = this.entries.shift();
                if (!entry.isCompleted) {  // !!!! Why?
                    this.makeRequest(entry);
                }
            }
        }
        finally {
            this.inDequeue = false;
        }
    }

    private scheduleDequeue(): void {
        if (!this.dequeueTimeout && this.entries.length !== 0) {
            this.dequeueTimeout = setTimeout(() => {
                this.dequeueTimeout = undefined;
                this.dequeue();
            });
        }
    }

    private cancel(entry: GeocodeQueueEntry): void {
        if (!entry.jsonp) {
            let request: BingAjaxRequest = entry.request;
            if (request) {
                entry.request = null;
                request.abort();
            }
        }

        this.complete(entry, { error: new Error('cancelled') });
    }

    private complete(entry: GeocodeQueueEntry, result: IGeocodeResult): void {
        if (!entry.isCompleted) {
            entry.isCompleted = true;

            if (entry.item.promise.pending()) {
                if (!result || !result.coordinates) {
                    entry.item.promise.reject(result && result.error || new Error('cancelled'));
                }
                else {
                    //entry.item.promise.resolve(result.coordinates); /// !!! logic
                }
            }
        }

        this.scheduleDequeue();
    }

    private makeJsonpAjaxQuery(entry: GeocodeQueueEntry): void {
        let guidSequence = () => {
            let cryptoObj = window.crypto || window["msCrypto"]; // For IE

            return cryptoObj.getRandomValues(new Uint32Array(1))[0].toString(16).substring(0, 4);
        };

        const callbackGuid: string = `GeocodeCallback${guidSequence()}${guidSequence()}${guidSequence()}`;

        // This is super dirty hack to bypass faked window object in order to use jsonp
        // We use jsonp because sandboxed iframe does not have an origin. This fact breaks regular AJAX queries.
        window[this.callbackObjectName][callbackGuid] = (data) => {
            if (entry.request) {
                entry.request.always(() => {
                    _.pull(this.activeEntries, entry);
                    entry.request = null;
                });
            }
            try {
                this.complete(entry, entry.item.query.getResult(data));
            }
            catch (error) {
                this.complete(entry, { error: error });
            }

            delete window[this.callbackObjectName][callbackGuid];
        };

        entry.jsonp = true;

        let url: string = entry.item.query.getUrl();

        if (!url) {
            this.complete(entry, { error: new Error("Unsupported query.") });
            return;
        }

        this.activeEntries.push(entry);

        //fetchJsop !

        entry.request = $.ajax({
            url: url,
            dataType: 'jsonp',
            crossDomain: true,
            jsonp: "jsonp",
            context: entry,
            jsonpCallback: `window.${this.callbackObjectName}.${callbackGuid}`
        });
    }

    private makeRequest(entry: GeocodeQueueEntry): void {
        if (entry.item.query["query"] === "") {
            this.cancel(entry);
            return;
        }

        this.makeJsonpAjaxQuery(entry);
    }
}
