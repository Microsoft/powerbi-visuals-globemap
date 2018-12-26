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

import IPromise = powerbi.IPromise;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import { IGeocodeCoordinate, IGeocodeBoundaryCoordinate, } from "./geocoderInterfaces";

interface GeocodeCacheEntry {
    coordinate: IGeocodeCoordinate;
    hitCount: number;
}

export interface IGeocodingCache {
    getCoordinates(key: string): JQueryDeferred<{}>;
    registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void;
    registerCoordinates(key: string, coordinate: IGeocodeBoundaryCoordinate): void;
}

export function createGeocodingCache(maxCacheSize: number, maxCacheSizeOverflow: number): IGeocodingCache {
    return new GeocodingCache(maxCacheSize, maxCacheSizeOverflow, window["localStorageService"]);
}

export class GeocodingCache implements IGeocodingCache {
    private geocodeCache: _.Dictionary<GeocodeCacheEntry>;
    private geocodeCacheCount: number;
    private maxCacheSize: number;
    private maxCacheSizeOverflow: number;
    private localStorageService: ILocalVisualStorageService;

    private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";

    constructor(maxCacheSize: number, maxCacheSizeOverflow: number, localStorageService: ILocalVisualStorageService) {
        this.geocodeCache = {};
        this.geocodeCacheCount = 0;
        this.maxCacheSize = maxCacheSize;
        this.maxCacheSizeOverflow = maxCacheSizeOverflow;
        this.localStorageService = localStorageService;
    }

    public static getShortKey(key: string): string {
        if (!key || !key.length) {
            return key;
        }
        return key.match(/([^;]+)$/i)[0].replace(/\/$/g, '').trim();
    }

    /**
    * Retrieves the coordinate for the key from the cache, returning undefined on a cache miss.
    */
    public getCoordinates(key: string): JQueryDeferred<{}> {
        let deferred = $.Deferred();
        let result = undefined;
        // Check in-memory cache
        const shortKey: string = GeocodingCache.getShortKey(key);
        let pair: GeocodeCacheEntry = this.geocodeCache[shortKey];
        if (pair) {
            ++pair.hitCount;
            result = pair.coordinate;
            return deferred.resolve(result);
        }
        // Check local storage cache
        const localStoragePromise: IPromise<string> = this.localStorageService.get(GeocodingCache.TILE_LOCATIONS);
        localStoragePromise.then((value) => {
            const parsedValue = JSON.parse(value);
            if (!parsedValue) {
                return deferred.resolve(result);
            }

            // Register all keys in memory
            for (let parsedKey in parsedValue) {
                const location = parsedValue[parsedKey];
                pair = {
                    coordinate: {
                        latitude: location.lat,
                        longitude: location.lon
                    }
                } as GeocodeCacheEntry;

                const shortParsedKey: string = GeocodingCache.getShortKey(parsedKey);
                this.registerInMemory(shortParsedKey, pair.coordinate);

                if (parsedKey === shortKey) {
                    result = pair.coordinate;
                    deferred.resolve(result);
                }
            }
        })
            .catch(() => {
                deferred.resolve(result);
            });

        return deferred;
    }
    /**
    * Registers the query and coordinate to the cache.
    */
    public registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void {
        this.registerInMemory(key, coordinate);
        this.registerInStorage(key, coordinate);
    }

    private registerInMemory(key: string, coordinate: IGeocodeCoordinate): void {
        let geocodeCache: _.Dictionary<GeocodeCacheEntry> = this.geocodeCache;
        let maxCacheSize: number = this.maxCacheSize;
        let maxCacheCount: number = maxCacheSize + this.maxCacheSizeOverflow;

        // are we about to exceed the maximum?
        if (this.geocodeCacheCount >= maxCacheCount) {
            let keys: string[] = Object.keys(geocodeCache);
            let cacheSize: number = keys.length;

            // sort keys in *descending* hitCount order
            keys.sort((a: string, b: string) => {
                let cachedA: GeocodeCacheEntry = geocodeCache[a];
                let cachedB: GeocodeCacheEntry = geocodeCache[b];
                let ca: number = cachedA ? cachedA.hitCount : 0;
                let cb: number = cachedB ? cachedB.hitCount : 0;
                return ca < cb ? 1 : (ca > cb ? -1 : 0);
            });

            // whack ones with the lower hitCounts.
            // - while # whacked keys is small, do a quick wipe
            // - after awhile we get lots of keys whose cached value is undefined.
            //   when there are "too many," make a whole new memory cache.
            if (cacheSize < 2 * maxCacheCount) {
                for (let i = maxCacheSize; i < cacheSize; i++) {
                    geocodeCache[keys[i]] = undefined;
                }
            }
            else {
                let newGeocodeCache: _.Dictionary<GeocodeCacheEntry> = {};
                for (let i = 0; i < maxCacheSize; ++i) {
                    newGeocodeCache[keys[i]] = geocodeCache[keys[i]];
                }

                geocodeCache = this.geocodeCache = newGeocodeCache;
            }

            this.geocodeCacheCount = maxCacheSize;
        }

        geocodeCache[key] = { coordinate: coordinate, hitCount: 1 };
        ++this.geocodeCacheCount;
    }

    private registerInStorage(key: string, coordinate: IGeocodeCoordinate): JQueryDeferred<{}> {
        const valuesObj = {};
        const shortKey: string = GeocodingCache.getShortKey(key);
        let deferred = $.Deferred();
        valuesObj[shortKey] = {
            "lon": coordinate.longitude,
            "lat": coordinate.latitude
        };
        let valueObjectToString: string = JSON.stringify(valuesObj);
        this.localStorageService.get(GeocodingCache.TILE_LOCATIONS).then((data) => {
            const locations = JSON.parse(data);
            const mergedObject = location ? _.extend(locations, valuesObj) : valuesObj;
            valueObjectToString = JSON.stringify(mergedObject);
            this.localStorageService.set(GeocodingCache.TILE_LOCATIONS, valueObjectToString);
            deferred.resolve();
        }).catch(() => {
            this.localStorageService.set(GeocodingCache.TILE_LOCATIONS, valueObjectToString).then(() => deferred.resolve("success")).catch(() => deferred.reject());
        });

        return deferred;
    }
}