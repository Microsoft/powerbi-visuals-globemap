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

import DataView = powerbi.DataView;
import { ValueType } from "powerbi-visuals-utils-typeutils/lib/valueType";
import { TestDataViewBuilder } from "powerbi-visuals-utils-testutils/lib/dataViewBuilder/testDataViewBuilder";
import { getRandomNumbers } from "powerbi-visuals-utils-testutils";

export class GlobeMapData extends TestDataViewBuilder {
    public static ColumnSource: string = "Location";
    public static ColumnValue: string = "Height";
    public static ColumnLongitude: string = "Longitude";
    public static ColumnLatitude: string = "Latitude";

    public valuesSourceDestination: string[] = [
        'Riyadh, Saudi Arabia',
        'New Taipei City, Republic of China',
        'Jakarta, Indonesia',
        'Casablanca, Morocco',
        'Shenzhen, China',
        'Addis Ababa, Ethiopia',
        'Cairo, Egypt',
        'Surat, India',
        'Tehran, Iran',
        'Lagos, Nigeria',
        'Jeddah, Saudi Arabia',
        'Cape Town, South Africa',
        'Shanghai, China',
        'Lima, Peru',
        'Durban, South Africa',
        'London, United Kingdom',
        'Ahmedabad, India',
        'Mexico City, Mexico',
        'Chennai, India'
    ];

    public latitudeSourceDestination: number[] = [
        24.7388,
        24.911449,
        -6.199707,
        33.557617,
        22.603919,
        8.958422,
        30.053986,
        21.142542,
        35.707666,
        6.499765,
        21.370158,
        -33.925165,
        31.170009,
        -12.045775,
        -29.845546,
        51.513605,
        23.036129,
        19.377726,
        13.05915
    ];

    public longitudeSourceDestination: number[] = [
        46.872447,
        121.517012,
        106.760508,
        -7.649532,
        113.951561,
        38.725271,
        31.244216,
        72.815901,
        51.32757,
        3.273896,
        39.212623,
        18.568671,
        121.204812,
        -77.058747,
        30.966266,
        -0.168895,
        72.510046,
        -99.136068,
        80.237908
    ];

    public valuesValue: number[] = getRandomNumbers(this.valuesSourceDestination.length, 10, 500);

    public getDataView(columnNames?: string[]): DataView {

        return this.createCategoricalDataViewBuilder([
            {
                source: {
                    displayName: GlobeMapData.ColumnSource,
                    roles: { [GlobeMapData.ColumnSource]: true },
                    type: ValueType.fromDescriptor({ text: true })
                },
                values: this.valuesSourceDestination.map(x => x[0])
            }
        ], [
                {
                    source: {
                        displayName: GlobeMapData.ColumnValue,
                        roles: { [GlobeMapData.ColumnValue]: true },
                        isMeasure: true,
                        type: ValueType.fromDescriptor({ numeric: true }),
                    },
                    values: this.valuesValue
                },
                {
                    source: {
                        displayName: GlobeMapData.ColumnLatitude,
                        roles: { [GlobeMapData.ColumnLatitude]: true },
                        isMeasure: true,
                        type: ValueType.fromDescriptor({ numeric: true }),
                    },
                    values: this.latitudeSourceDestination
                },
                {
                    source: {
                        displayName: GlobeMapData.ColumnLongitude,
                        roles: { [GlobeMapData.ColumnLongitude]: true },
                        isMeasure: true,
                        type: ValueType.fromDescriptor({ numeric: true }),
                    },
                    values: this.longitudeSourceDestination
                }
            ], columnNames).build();
    }
}
