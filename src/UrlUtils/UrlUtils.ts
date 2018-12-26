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

export module UrlUtils {
    /**
     * Given a URL, set the provided query string parameters
     * @param url The URL to modify
     * @param parameters The query parameters to set.
     * @param keepExisting if true, existing query parameters will be maintained, even if specified in the parameters argument. Else, all existing parameters are removed
     */
    export function setQueryParameters(url: string, parameters: _.Dictionary<string>, keepExisting = false): string {
        const splitUrl: IUrlParameters = splitUrlAndQuery(url);
        let result: string = splitUrl.baseUrl;

        if (keepExisting) {
            _.assign(parameters, splitUrl.queryParameters);
        }

        if (_.isEmpty(parameters)) {
            return result;
        }

        result += `?${
            _.chain(parameters)
                .toPairs()
                .map(pair => pair.join("="))
                .value()
                .join("&")
            }`;

        return result;
    }

    /** Given a URL, split it into the base URL (everything before the query string) and its collection of query string parameters */
    export function splitUrlAndQuery(url: string): IUrlParameters {
        const queryString: string = getQueryString(url);
        const baseUrl: string = queryString ? url.slice(0, url.lastIndexOf(queryString)) : url;

        return {
            baseUrl: baseUrl,
            queryParameters: parseQueryString(queryString)
        };
    }

    function getQueryString(url: string): string {
        let elem: HTMLAnchorElement = document.createElement("a");
        elem.href = url;

        return elem.search;
    }

    /** Parses a query string of the form ?param1=value1&param2=value2 into its invidual parameters. The leading ? is not required */
    function parseQueryString(queryString: string): _.Dictionary<string> {
        if (!queryString) {
            return null;
        }

        if (_.startsWith(queryString, "?")) {
            queryString = queryString.substring(1);
        }

        let params: string[] = queryString.split("&");

        let result: _.Dictionary<string> = {};
        for (let keyEqualsValue of params) {
            let pair = keyEqualsValue.split("=");
            result[pair[0]] = decodeURIComponent(pair[1]);
        }

        return result;
    }

    export interface IUrlParameters {
        baseUrl: string;
        queryParameters: _.Dictionary<string>;
    }
}