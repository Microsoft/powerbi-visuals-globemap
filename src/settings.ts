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


// powerbi.extensibility.utils.dataview
import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export const CacheSettings = {
    /** Maximum cache size of cached geocode data. */
    MaxCacheSize: 3000,

    /** Maximum cache overflow of cached geocode data to kick the cache reducing. */
    MaxCacheSizeOverflow: 100,
};

export const BingSettings = {
    /** Maximum Bing requests at once. The Bing have limit how many request at once you can do per socket. */
    MaxBingRequest: 6,

    // Add your Bing key here
    BingKey: "YzyBFJgUrMNy4UEJWNpt~3ia-8PWaplOLtxqAWUD9dQ~As3csOrjB7b4KJ7cY6vkaSZsJT4FsKjE0rvTYJPZx-xaFSvB5IV0u3-KJnM0zNon"
};

export class GlobeMapSettings extends DataViewObjectsParser {
    public dataPoint: DataPointSettings = new DataPointSettings();
}

export class DataPointSettings {
}