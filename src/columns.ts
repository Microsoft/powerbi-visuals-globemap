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
import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;

export type GlobeMapCategoricalColumns = DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns;

export class GlobeMapColumns<T> {
    public static getCategoricalColumns(dataView: DataView): GlobeMapColumns<GlobeMapCategoricalColumns> {
        let categorical = dataView && dataView.categorical;
        let categories = categorical && categorical.categories || [];
        let values = categorical && categorical.values || <DataViewValueColumns>[];
        return categorical && _.mapValues(
            new this<DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns>(),
            (n, i) => categories.filter(x => x.source.roles && x.source.roles[i])[0]
                || values.source && values.source.roles && values.source.roles[i] && values
                || values.filter(x => x.source.roles && x.source.roles[i]));
    }

    public static getGroupedValueColumns(dataView: DataView): GlobeMapColumns<DataViewValueColumn>[] {
        let categorical: DataViewCategorical = dataView && dataView.categorical;
        let values = categorical && categorical.values;
        let grouped: DataViewValueColumnGroup[] = values && values.grouped();
        return grouped && grouped.map(g => _.mapValues(
            new this<DataViewValueColumn>(),
            (n, i) => g.values.filter(v => v.source.roles[i])[0]));
    }

    public Location: T = null;
    public Series: T = null;
    public X: T = null;
    public Y: T = null;
    public Height: T = null;
    public Heat: T = null;
}
