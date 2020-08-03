import * as React from "react";
import { hot } from "react-hot-loader";

import {
    Button, Grid, Segment, Label,
    Divider, Form, Message, Container,
    Header, Dropdown, DropdownItemProps,
    Item, Progress, Transition, Popup, Image, Icon
} from 'semantic-ui-react'


import Worker from '../worker/Worker';
import {
    WorkStatus, CalcDataType, GizmoType, CalcData,
    GizmoResult, WorkerStatusReport, ANY_PERK, NO_PERK, WorkerCalcRequest
} from '../worker/WorkerTypes';

import {
    getGizmoIcon, getComponentIcon, getPerkIcon, getPerkRankIcon,
    // compList, perkList

} from './Icons'

import "./../assets/scss/App.scss";

//////////////////////

interface AppState {
    gizmoType: GizmoType,
    ancientGizmo: boolean,
    perkNames: string[]
    perkRanks: { [perkName: string]: number },
    allowPositiveSecondPerk: boolean,

    calcInProgress: boolean,
    calcComplete: boolean,
    calcProgress: number,

    warningShown: boolean,
    warningMsg: string,

    searchPerkNames: string[],
    searchPerkRanks: number[],
    searchGizmoType: GizmoType,
    searchGizmoAncient: boolean,
    searchGizmoResults: GizmoResult[]
}
/**
 * // to enumerate perks of gizmo type: Object.keys(CalcData.perkToComp[gizmoType])
 * // to get info of a perk: CalcData.perkInfo[perkName]
 */
/**
 * [ ]Show selected option in search results:
 * Append 'dummy objects' for each perk and hijack the search function to show the dummy perks when their
 * regular counterpart is in the selection.
 * Then when on selection of a dummy perk, change the corresponding rank.
 * [ ] Or alternatively, inject a dummy item with a search hijack
 * [x] rank selection
 * 
 * [x] prog bar
 * [x] error msg
 * [ ] display no results message
 * [ ] display dropdown perks in order of desirability
 * [ ] label on hover components
 * [ ] 1/x display of success chance
 * [ ] display of noEffectChance (?)
 * 
 * [ ] split interface into PureComponents to avoid slowdown when changing options with search
 * results displayed
 * 
 * [ ] for a certain combination of materials of certain quantities, all
 * combinations with greater quantities of each, that produce the same probability,
 * should be excluded. could be difficult to filter? problem could disappear with 
 * gizmoCost implementation as well
 * 
 * [ ] add a github source code button
 * [ ] add time taken, and a timer somewhere
 * 
 * [x] reorganize codes, put invention budget generation code into gss_utils.ts and rename to inventionBudgetUtils
 * 
 * [x] open in rswiki button, align to bottom
 * [x] gizmo type label, larger depending on screen size
 * 
 * [/] when adding perk already in list, update with new rank!
 * [x] if change to ancient gizmo, alert if rank exceeds max! - we just delete it now cuz it's not valid.
 * [ ] add information signs for combolist instruction; explanation of what is a positive secondary perk
 * [ ] unselect label in the dropdown
 * 
 * [x] transition animation
 * 
 * [x] close dropdown on selection of option
 * 
 * [x] hide ancient only perks on regular gizmo mode, or render it unselectable
 * [ ] don't show rank button on perks with 1 rank
 * [x] display gizmo type
 * [x] display perk graphics and gizmo graphics
 * 
 * [ ] interface to exclude perks or materials, can make use of dropdown+labels method, as well as directly add from results
 * [ ] show other perk possibilities on result gizmos (not as necessary, since you can open rswiki calc anyway)
 * [ ] to counter low lvl perks with many possible combos: prioritize the lowest/cheapest material
 * quantities first, and terminate the search upon finding enough 100% gizmos
 */

class App extends React.Component<{}, AppState> {
    setTargetRankFn = (perkName, rank) => {
        this.setState({
            perkRanks: Object.assign(this.state.perkRanks, { [perkName]: rank })
        }, () => console.log(this.state.perkRanks));

    };

    selectedPerksUpdateFn = (newPerkNames) => {
        /**
         * If new perknames exceed 2: error of list too long
         * If new perk added: newperk=perk[0] or perk[1]
         * If perk was removed: removedperk=oldPerk[0] or oldPerk[1] (use this.state.perkNames)
         *      -Delete perk Rank
         */
        const oldPerkNames = this.state.perkNames;
        if (newPerkNames.length > 2) {
            return;
        }
        if (newPerkNames.length > oldPerkNames.length) {
            let newPerk = newPerkNames[newPerkNames.length - 1];
            if (this.state.perkRanks[newPerk]) {
                this.setState({
                    perkNames: newPerkNames
                });
            }
        } else if (newPerkNames.length < oldPerkNames.length) {
            // find the perk name (amongst the old perk list) that is not present in the new perk list
            let deletedPerks = oldPerkNames.filter(pn => newPerkNames.indexOf(pn) === -1);
            console.log("Deleted perks", deletedPerks);
            let newPerkRanks = Object.assign(this.state.perkRanks, {});
            for (const deletedPerk of deletedPerks)
                delete newPerkRanks[deletedPerk];

            this.setState({
                perkNames: newPerkNames,
                perkRanks: newPerkRanks,
            });
        } else {
            console.error("perks did not change during onChange call");
        }
    };

    handleChangeGizmoType = (e, { value }) => {
        // when changing gizmo type, delete (from perkNames and perkRanks) the selected perks that are no longer valid
        let psd: DropdownItemProps[] = this.PerkSearchData[value][this.state.ancientGizmo ? 1 : 0];
        let oldPerkNames = this.state.perkNames;
        let newValid = psd.filter(itemProps => oldPerkNames.indexOf(itemProps.value) !== -1).map(itemProps => itemProps.value);
        // console.log(newValid);
        let newPerkNames = [];
        let newPerkRanks = Object.assign(this.state.perkRanks, {});
        for (let i = 0; i < oldPerkNames.length; i++) {
            const perkName = oldPerkNames[i];
            if (newValid.indexOf(perkName) !== -1) {
                newPerkNames.push(perkName);
            } else {
                delete newPerkRanks[perkName]
            }
        }

        this.setState({
            gizmoType: value,
            perkNames: newPerkNames,
            perkRanks: newPerkRanks
        });
    };
    handleChangeGizmoTier = (e, { checked }) => {
        // delete perk if rank exceeds max
        let newPerkNames = [];
        let newPerkRanks = Object.assign(this.state.perkRanks, {});
        if (checked) {
            newPerkNames = [...this.state.perkNames];
        } else {
            for (let i = 0; i < this.state.perkNames.length; i++) {
                const perkName = this.state.perkNames[i];
                const { ranks, ancientOnly } = CalcData.perkInfo[perkName];
                if (ancientOnly[newPerkRanks[perkName] - 1] === 0) {
                    newPerkNames.push(perkName);
                } else {
                    delete newPerkRanks[perkName]
                }
            }

        }
        this.setState({
            ancientGizmo: checked,
            perkNames: newPerkNames,
            perkRanks: newPerkRanks
        });

    }

    renderLabelFn = (label: DropdownItemProps) => {
        const perkName = label.value as string;
        const { ranks, ancientOnly } = CalcData.perkInfo[perkName];
        if (ranks.length === 1) {
            return ({
                content: `${label.text}`,
            })
        } else {
            return ({
                content: `${label.text} ${this.state.perkRanks[perkName]}`,
                // icon: 'check',
            })
        }

    };

    dropdownOptionFn = (perkName, isAncient) => {
        const { ranks, ancientOnly } = CalcData.perkInfo[perkName];
        let rankOptions = ranks.filter(n => isAncient || ancientOnly[n - 1] === 0).map((n) => (
            <Grid.Column key={n} width={2} verticalAlign="middle" textAlign="center" className="perk-selection-rank-number"
                onClick={() => this.setTargetRankFn(perkName, n)}>
                {n}
            </Grid.Column>
        ));
        return ({
            key: perkName,
            text: perkName,
            value: `${perkName}`,
            content: (
                <Grid divided columns='equal'>
                    <Grid.Column onClick={() => this.setTargetRankFn(perkName, rankOptions.length)}>
                        {perkName}
                    </Grid.Column>
                    {rankOptions}
                </Grid >
            ),
        });
    };

    searchFn = (options, query) => {
        if (this.state.perkNames.length >= 2) return [];
        else return options.filter((opt) => opt.text.replace(" ", "").toLowerCase().indexOf(query.replace(" ", "").toLowerCase()) !== -1);

    };

    beginGizmoSearchFn = () => {
        // this.setState({ calcInProgress: !this.state.calcInProgress });
        if (this.state.perkNames.length === 0) {
            this.setState({ warningShown: true, warningMsg: "Add at least one perk to continue." })
            return;
        }
        if (this.state.calcInProgress)
            return;

        const { perkNames, perkRanks, gizmoType, ancientGizmo } = this.state;
        let sPN = [...perkNames];
        let sPR = this.state.perkNames.map(perkName => perkRanks[perkName]); // ANY_PERK and NO_PERK will be mapped to undefined

        if (sPN.length === 1) {
            if (this.state.allowPositiveSecondPerk)
                sPN.push(ANY_PERK);
            else
                sPN.push(NO_PERK);
        }

        this.setState({
            searchPerkNames: sPN,
            searchPerkRanks: sPR,
            searchGizmoType: gizmoType,
            searchGizmoAncient: ancientGizmo,
            calcInProgress: true,
            calcComplete: false,
            calcProgress: 0
        }, () => {
            this.GizmoSearchWorker.postMessage({
                targetPerkNames: sPN,
                targetPerkRanks: sPR,
                targetGizmoType: gizmoType,
                targetGizmoAncient: ancientGizmo,
            } as WorkerCalcRequest)
        });

        /*
        if (this.state.calcComplete) {
            this.setState({ calcInProgress: false, calcComplete: false });
        } else if (this.state.calcInProgress) {
            this.setState({ calcInProgress: false, calcComplete: true });
        } else {
            this.setState({ calcInProgress: true });
        }*/
    }

    cancelGizmoSearchFn = () => {
        if (!this.state.calcInProgress) {
            console.log('no calculation to cancel');
            return;
        }

        // terminate and restart the worker
        delete this.GizmoSearchWorker.onmessage;
        this.GizmoSearchWorker.terminate();
        this.GizmoSearchWorker = new Worker();
        this.GizmoSearchWorker.onmessage = this.handleWorkerProgressFn;
        // revert state to beginning
        this.setState({
            calcInProgress: false,
            calcComplete: false,
            calcProgress: 0,
        });

    };

    handleWorkerProgressFn = (event) => {
        let data: WorkerStatusReport = event.data;

        console.assert(this.state.calcInProgress, 'progress reported for no calculation');
        if (data.workerStatus === WorkStatus.InProgress) {
            this.setState({
                calcProgress: data.percentComplete
            });
        } else if (data.workerStatus === WorkStatus.Complete) {
            this.setState({
                calcProgress: 100,
                calcComplete: true,
                calcInProgress: false,
                searchGizmoResults: data.result
            });
        } else {
            console.error('invalid worker status');
        }
    }

    GizmoSearchWorker: Worker;

    /** contains the html elements for the dropdown, indexed as: PerkSearchData[GizmoType][AncientOnly] where AncientOnly is 0 or 1 */
    PerkSearchData;
    constructor(props) {
        super(props);
        // console.time("initSearchData");
        this.PerkSearchData = {
            [GizmoType.Armour]: {
                0: Object.keys(CalcData.perkToComp['armour']).map(x => this.dropdownOptionFn(x, false)),
                1: Object.keys(CalcData.perkToComp['armour']).map(x => this.dropdownOptionFn(x, true)),
            },
            [GizmoType.Weapon]: {
                0: Object.keys(CalcData.perkToComp['weapon']).map(x => this.dropdownOptionFn(x, false)),
                1: Object.keys(CalcData.perkToComp['weapon']).map(x => this.dropdownOptionFn(x, true)),
            },
            [GizmoType.Tool]: {
                0: Object.keys(CalcData.perkToComp['tool']).map(x => this.dropdownOptionFn(x, false)),
                1: Object.keys(CalcData.perkToComp['tool']).map(x => this.dropdownOptionFn(x, true)),
            },
        };
        // console.timeEnd("initSearchData");


        this.GizmoSearchWorker = new Worker();
        this.GizmoSearchWorker.onmessage = this.handleWorkerProgressFn;
    }
    state = {
        gizmoType: GizmoType.Weapon,
        ancientGizmo: false,
        perkNames: [],
        perkRanks: {},
        allowPositiveSecondPerk: true,

        calcInProgress: false,
        calcComplete: false,
        calcProgress: 0,

        warningShown: false,
        warningMsg: '',

        searchPerkNames: [],
        searchPerkRanks: [],
        searchGizmoType: GizmoType.Armour,
        searchGizmoAncient: false,
        searchGizmoResults: []
    }

    public render() {
        const { gizmoType, ancientGizmo, perkNames, allowPositiveSecondPerk } = this.state;
        const { warningShown, warningMsg } = this.state;

        let searchResultItems;
        if (this.state.calcComplete) {
            let gizmoTypeString = `${this.state.searchGizmoAncient ? 'Ancient' : 'Regular'} `;
            gizmoTypeString += `${this.state.searchGizmoType === GizmoType.Armour ? 'armour gizmo'
                : this.state.searchGizmoType === GizmoType.Weapon ? 'weapon gizmo'
                    : 'tool gizmo'}`;

            let targetPerkName1 = this.state.searchPerkNames[0];
            let targetPerkRank1 = this.state.searchPerkRanks[0]
            let targetPerkString = targetPerkName1;
            if (CalcData.perkInfo[targetPerkName1].ranks.length > 1) {
                targetPerkString += ' ' + targetPerkRank1;
            }

            if (this.state.searchPerkNames[1] && this.state.searchPerkNames[1] !== NO_PERK) {
                let targetPerkName2 = this.state.searchPerkNames[1];
                let targetPerkRank2 = (targetPerkName2 === ANY_PERK || CalcData.perkInfo[targetPerkName2].ranks.length === 1)
                    ? ' '
                    : (' ' + this.state.searchPerkRanks[1]);
                targetPerkString += ' + ' + targetPerkName2;
                targetPerkString += targetPerkRank2;
            }

            searchResultItems = (
                <Item.Group divided unstackable>
                    {this.state.searchGizmoResults.map((gizmoResult: GizmoResult, gizmoResultIdx) => {
                        let wikiLink = 'https://runescape.wiki/w/Calculator:Perks?';
                        let amp = false;
                        if (gizmoResult.materialsArrangement[5])
                            wikiLink += `${amp ? '&' : (amp=true, '')}top-left=${gizmoResult.materialsArrangement[5].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[1])
                            wikiLink += `${amp ? '&' : (amp=true, '')}top=${gizmoResult.materialsArrangement[1].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[6])
                            wikiLink += `${amp ? '&' : (amp=true, '')}top-right=${gizmoResult.materialsArrangement[6].replace(' ', '+')}`;

                        if (gizmoResult.materialsArrangement[2])
                            wikiLink += `${amp ? '&' : (amp=true, '')}left=${gizmoResult.materialsArrangement[2].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[0])
                            wikiLink += `${amp ? '&' : (amp=true, '')}middle=${gizmoResult.materialsArrangement[0].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[3])
                            wikiLink += `${amp ? '&' : (amp=true, '')}right=${gizmoResult.materialsArrangement[3].replace(' ', '+')}`;

                        if (gizmoResult.materialsArrangement[7])
                            wikiLink += `${amp ? '&' : (amp=true, '')}bottom-left=${gizmoResult.materialsArrangement[7].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[4])
                            wikiLink += `${amp ? '&' : (amp=true, '')}bottom=${gizmoResult.materialsArrangement[4].replace(' ', '+')}`;
                        if (gizmoResult.materialsArrangement[8])
                            wikiLink += `${amp ? '&' : (amp=true, '')}bottom-right=${gizmoResult.materialsArrangement[8].replace(' ', '+')}`;

                        if (this.state.searchGizmoType === GizmoType.Armour)
                            wikiLink += `&type=Armour`;
                        else if (this.state.searchGizmoType === GizmoType.Weapon)
                            wikiLink += `&type=Weapon`;
                        else if (this.state.searchGizmoType === GizmoType.Tool)
                            wikiLink += `&type=Tool`;
                        else
                            console.error('unknown gizmo type');

                        wikiLink += `&lvl=${gizmoResult.optimalInventionLevel}`;

                        if (this.state.searchGizmoAncient)
                            wikiLink += '&ancient=true';

                        wikiLink += `&potion=None`;

                        return (
                            <Item key={gizmoResultIdx}>
                                <Item.Image>
                                    <Label size='large' className='gizmo-type-label'>
                                        {gizmoTypeString}
                                    </Label>
                                    <div className='component-grid'>
                                        {[5, 1, 6, 2, 0, 3, 7, 4, 8].map(idx => {
                                            // console.log(gizmoResult.materialsArrangement);
                                            return (<div key={idx} className='component-grid-cell'>
                                                {gizmoResult.materialsArrangement[idx] &&
                                                    <Image src={getComponentIcon(gizmoResult.materialsArrangement[idx])}
                                                        className='component-grid-cell-img' />
                                                }
                                            </div>)

                                        })}
                                    </div>
                                </Item.Image>

                                <Item.Content style={{ position: 'relative' }}>
                                    <Item.Header>
                                        {targetPerkString} (combo #{gizmoResultIdx + 1})
                                </Item.Header>
                                    <Item.Meta>
                                        {gizmoResult.componentQuantities
                                            .map(([compName, quantity]) => `${quantity} ${compName}`)
                                            .join(', ')}
                                    </Item.Meta>
                                    <Item.Description>
                                        Success rate per gizmo: {(100 * gizmoResult.successRatePerGizmo).toPrecision(4)}%
                                </Item.Description>
                                    <Item.Description>
                                        Optimal invention level: {gizmoResult.optimalInventionLevel}
                                    </Item.Description>
                                    {/** no effect chance */}
                                    <Item.Extra>
                                        <Button size='small' as='a' target='_blank'
                                            href={wikiLink} >
                                            <Icon name='external' /> Open in RsWiki {/** todo */}
                                        </Button>
                                    </Item.Extra>
                                </Item.Content>
                            </Item>
                        )
                    })}
                </Item.Group>
            );
        }

        return (
            <Container style={{ marginTop: '2em' }} textAlign={"left"}>

                <Header>Gizmo Calculator</Header>
                <Form>
                    {/** Gizmo shape selection */}
                    <Form.Group inline>
                        <label>Gizmo Shell</label>
                        <Form.Radio widths={10}
                            label='Weapon'
                            value={GizmoType.Weapon}
                            checked={gizmoType === GizmoType.Weapon}
                            onChange={this.handleChangeGizmoType}
                        />
                        <Form.Radio widths={10}
                            label='Armour'
                            value={GizmoType.Armour}
                            checked={gizmoType === GizmoType.Armour}
                            onChange={this.handleChangeGizmoType}
                        />
                        <Form.Radio
                            label='Tool'
                            value={GizmoType.Tool}
                            checked={gizmoType === GizmoType.Tool}
                            onChange={this.handleChangeGizmoType}
                        />
                        <Form.Checkbox
                            label='Ancient'
                            checked={ancientGizmo}
                            onChange={this.handleChangeGizmoTier}
                        />
                    </Form.Group>
                    {/** Perk selection dropdown */}
                    <Form.Group widths={6}>
                        <Popup
                            content={warningMsg}
                            position='bottom center'
                            onClose={() => this.setState({ warningShown: false })}
                            // onOpen={()=>this.setState({warningShown:true})}
                            open={warningShown}
                            closeOnTriggerMouseLeave={false}
                            trigger={
                                <Form.Dropdown label='Target Perks' placeholder='Click here to add a perk' width={12}
                                    options={this.PerkSearchData[gizmoType][ancientGizmo ? 1 : 0]}
                                    onAddItem={undefined}
                                    value={perkNames}

                                    search={this.searchFn}
                                    selectedLabel={null} // prevent selecting labels for now
                                    renderLabel={this.renderLabelFn}
                                    onChange={(e, { value }) => this.selectedPerksUpdateFn(value)}
                                    onLabelClick={(e, { value }) => console.log(value)}
                                    searchQuery={perkNames.length >= 2 ? " " : undefined} // put a space there so the 'remove perk' msg shows

                                    noResultsMessage={perkNames.length >= 2 ? "Remove a perk before adding a new one..." : "No matching perks found"}
                                    openOnFocus={perkNames.length < 2}
                                    fluid selection multiple clearable scrolling
                                    closeOnChange
                                />
                            }
                        />



                    </Form.Group>
                    {/** Allow positive secondary perk checkbox */}
                    <Form.Group widths={12}>
                        <Form.Checkbox
                            label='Allow positive secondary perks' // gray out if double slot or two perks in search? also show info for list of excluded perks?
                            checked={allowPositiveSecondPerk}
                            onChange={(e, { checked }) => this.setState({ allowPositiveSecondPerk: checked })}
                        />
                    </Form.Group>
                    {/** Find combos button + cancel button */}
                    <Form.Group widths={12}>
                        {/**<Transition animation='pulse' duration={100} visible={!this.state.calcInProgress}>*/}
                        <Form.Button
                            onClick={this.beginGizmoSearchFn}
                            disabled={this.state.calcInProgress}>Find Combos</Form.Button>
                        <Transition.Group animation='scale' duration={100}>
                            {this.state.calcInProgress && <Form.Button onClick={this.cancelGizmoSearchFn}>Cancel...</Form.Button>}
                        </Transition.Group>
                    </Form.Group>

                </Form>
                <Divider />
                {/** Progress bar */}
                <Transition.Group animation='fade down' duration={100}>
                    {(this.state.calcInProgress || this.state.calcComplete)
                        && (
                            <div>
                                <Progress
                                    percent={this.state.calcProgress}
                                    label={this.state.calcComplete ? (this.state.searchGizmoResults.length ? "Complete!" : "This gizmo is impossible to make.") : "Calculating..."}
                                    progress='percent' active={!this.state.calcComplete} />
                                <Divider /></div>
                        )}

                </Transition.Group>
                {/** Results List */}
                <Transition.Group animation='fade up' duration={100}>
                    {/**
                     * Items can display:
                     * - combo ID
                     * - material arrangement (textual form)
                     * - optimal invention level
                     * - success chance
                     * - other perks
                     * - chance of no effect
                     */}
                    {searchResultItems}
                </Transition.Group>
            </Container >
        );
    }
}

declare let module: object;

export default hot(module)(App);
