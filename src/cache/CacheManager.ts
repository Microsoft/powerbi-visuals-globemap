import powerbi from "powerbi-visuals-api";
import * as _ from "lodash";
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";
import { MemoryCache } from "./memory";
import { LocalStorageCache } from "./localStorageAPI";
import { Bing } from "./bing";
import { ICacheManager } from "./interfaces/ICacheManager";
import { CacheSettings } from "./../settings";
import { ILocationKeyDictionary } from "../interfaces/dataInterfaces";

export class CacheManager implements ICacheManager {

    private memoryCache: ICacheManager;
    private localStorageCache: ICacheManager;
    private bing: ICacheManager;
    private coordsInLocalStorage: ILocationDictionary;

    constructor(localStorageService: ILocalVisualStorageService) {
        this.memoryCache = new MemoryCache(CacheSettings.MaxCacheSize, CacheSettings.MaxCacheSizeOverflow);
        this.localStorageCache = new LocalStorageCache(localStorageService);
        this.bing = new Bing();

        this.coordsInLocalStorage = {};
    }

    public async loadCoordinates(locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
        let result: ILocationDictionary = {};

        if (_.isEmpty(locationsDictionary)) {
            return new Promise<ILocationDictionary>(resolve => resolve(result));
        }

        let locationsInMemory = [];
        let locations: string[] = Object.keys(locationsDictionary);

        // load from memory
        let coordsInMemory: ILocationDictionary = await this.memoryCache.loadCoordinates(locations); // {"London": {"lat": 54, "lon": 34"}, "Moscow": {"lat": 64, "lon": 54"}
        locationsInMemory = Object.keys(coordsInMemory);                                             // ["London", "Moscow"]
        locations = locations.filter(loc => !locationsInMemory.includes(loc));                       // ["Moscow"] need to be loaded from LS or Bing

        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory);
            return new Promise<ILocationDictionary>(resolve => resolve(result));
        }

        // Load from localStorage
        if (_.isEmpty(this.coordsInLocalStorage)) {
            try {
                this.coordsInLocalStorage = await this.localStorageCache.loadCoordinates(locations);
            }
            catch (error) { console.log(error); }
        }

        if (this.coordsInLocalStorage) {
            let locationsInLocalStorage = Object.keys(this.coordsInLocalStorage);
            locations = locations.filter(loc => !locationsInLocalStorage.includes(loc));

            if (locations.length === 0) {
                result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage);
                return new Promise<ILocationDictionary>(resolve => resolve(result));
            }
        }

        // load from Bing
        locationsDictionary = locations
            .reduce((obj, key) => ({ ...obj, [key]: locationsDictionary[key] }), {});
        let coordsInBing = await this.bing.loadCoordinates(locations);
        result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage, coordsInBing);

        return new Promise<ILocationDictionary>(resolve => resolve(result));
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        await this.memoryCache.saveCoordinates(coordinates);
        return this.localStorageCache.saveCoordinates(coordinates);
    }
}