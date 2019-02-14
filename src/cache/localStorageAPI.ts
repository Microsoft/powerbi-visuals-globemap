import powerbi from "powerbi-visuals-api";
import * as _ from "lodash";
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import { ICacheManager } from "./interfaces/ICacheManager";
import { BaseCache } from "./base";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class LocalStorageCache extends BaseCache implements ICacheManager {

    private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";
    private localStorageService: ILocalVisualStorageService;

    constructor(localStorageService: ILocalVisualStorageService) {
        super();
        this.localStorageService = localStorageService;
    }

    public async loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        let result: ILocationDictionary = {};

        return new Promise<ILocationDictionary>((resolve, reject) => {
            this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS).then((data) => {
                const parsedValue = JSON.parse(data);
                if (!parsedValue) {
                    reject("Storage can not be parsed");
                }

                if (!keys || !keys.length) {
                    for (let key in parsedValue) {
                        if (parsedValue.hasOwnProperty(key)) {
                            const location = parsedValue[key];
                            if (location) {
                                result[key] = {
                                    latitude: location.lat,
                                    longitude: location.lon
                                };
                            }
                        }
                    }
                } else {
                    keys.forEach((key: string) => {
                        const location = parsedValue[key];
                        if (location) {
                            result[key] = {
                                latitude: location.lat,
                                longitude: location.lon
                            };
                        }
                    });
                }

                resolve(result);
            })
                .catch(() => {
                    reject("No locations in storage");
                });
        });
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        const locationItemsObject: {} = {};
        for (let key in coordinates) {
            locationItemsObject[key] = {
                "lon": coordinates[key].longitude,
                "lat": coordinates[key].latitude
            };
        }

        return new Promise<string>((resolve, reject) => {
            this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS).then((data) => {
                const locationsFromStorage = JSON.parse(data);
                const mergedObject = locationsFromStorage ? _.extend(locationsFromStorage, locationItemsObject) : locationItemsObject;

                const valueObjectToString = JSON.stringify(mergedObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => resolve("success"))
                    .catch(() => reject("Storage service save error"));
            }).catch(() => {
                const valueObjectToString = JSON.stringify(locationItemsObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => resolve("success"))
                    .catch(() => reject("Storage service save error"));
            });
        });
    }
}