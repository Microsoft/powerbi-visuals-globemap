import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";
import { ILocationKeyDictionary } from "../interfaces/dataInterfaces";

export class BaseCache implements ICacheManager {
    async loadCoordinates(data: string[] | ILocationKeyDictionary): Promise<ILocationDictionary> {
        return new Promise<ILocationDictionary>(() => { });
    }

    async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>(() => { });
    }
}