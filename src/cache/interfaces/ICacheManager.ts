import { ILocationDictionary } from "../../geocoder/interfaces/geocoderInterfaces";
import { ILocationKeyDictionary } from "../../interfaces/dataInterfaces";

export interface ICacheManager {
    loadCoordinates(data: string[] | ILocationKeyDictionary): Promise<ILocationDictionary>;
    saveCoordinates(coordinates: ILocationDictionary): Promise<string>;
}