import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary, ILocationCoordinateRecord, IGeocodeCoordinate } from "../geocoder/interfaces/geocoderInterfaces";

import { BaseCache } from "./base";

interface GeocodeCacheEntry {
    coordinate: IGeocodeCoordinate;
    hitCount: number;
}

export class MemoryCache extends BaseCache implements ICacheManager {
    private geocodeCache: _.Dictionary<GeocodeCacheEntry>;
    private geocodeCacheCount: number;
    private maxCacheSize: number;
    private maxCacheSizeOverflow: number;

    constructor(maxCacheSize: number, maxCacheSizeOverflow: number) {
        super();
        this.geocodeCache = {};
        this.geocodeCacheCount = 0;
        this.maxCacheSize = maxCacheSize;
        this.maxCacheSizeOverflow = maxCacheSizeOverflow;
    }

    public async loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        return new Promise<ILocationDictionary>((resolve, reject) => {
            if (!keys || !keys.length) {
                reject("No locations to be loaded");
            }
            let locations: ILocationDictionary = {};
            for (let key in this.geocodeCache) {
                if (this.geocodeCache[key]) {
                    this.geocodeCache[key].hitCount++;
                    locations[key] = this.geocodeCache[key].coordinate;
                }
            }

            resolve(locations);
        });
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!coordinates) {
                reject("No locations to be saved");
            }

            for (let key in coordinates) {
                let coordinateRecord: ILocationCoordinateRecord = {
                    key: key,
                    coordinate: {
                        latitude: coordinates[key].latitude,
                        longitude: coordinates[key].longitude
                    }
                };
                this.saveCoordinate(coordinateRecord);
                resolve("success");
            }
        });
    }

    public async saveCoordinate(locationRecord: ILocationCoordinateRecord) {
        let geocodeCache: _.Dictionary<GeocodeCacheEntry> = this.geocodeCache;

        if (geocodeCache[locationRecord.key]) {
            return;
        }

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

        geocodeCache[locationRecord.key] = { coordinate: locationRecord.coordinate, hitCount: 1 };
        ++this.geocodeCacheCount;
    }

}
