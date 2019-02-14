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

import DataView = powerbi.DataView;
import VisualUpdateType = powerbi.VisualUpdateType;

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { VisualBuilderBase, renderTimeout } from "powerbi-visuals-utils-testutils";
import { GlobeMap as VisualClass } from "../src/globemap";

export class GlobeMapBuilder extends VisualBuilderBase<VisualClass> {
    private static ChangeAllType: number = 62;
    constructor(width: number, height: number) {
        super(width, height, "GlobeMap1447669447625");
    }

    public update(dataView: DataView[] | DataView, updateType?: VisualUpdateType): void {
        let options: VisualUpdateOptions = {
            dataViews: _.isArray(dataView) ? dataView : [dataView],
            viewport: this.viewport,
            type: updateType
        };

        this.visual.update(options);
    }

    public updateRenderTimeout(
        dataViews: DataView[] | DataView,
        fn: Function,
        updateType: VisualUpdateType = GlobeMapBuilder.ChangeAllType,
        timeout?: number): number {
        this.update(dataViews, updateType);
        return renderTimeout(fn, timeout);
    }

    protected build(options: VisualConstructorOptions): VisualClass {
        return new VisualClass(options);
    }

    public get instance(): VisualClass {
        return this.visual;
    }
}
