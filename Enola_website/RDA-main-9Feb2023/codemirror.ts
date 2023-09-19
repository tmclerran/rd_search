import { basicSetup, EditorState, EditorView } from '@codemirror/basic-setup';
import { autocompletion, CompletionContext, startCompletion } from "@codemirror/autocomplete"
// import bookmarkedDiseaseData from '../mi1-rare-disease/dx1.json'       //test data until api is working
// import searchHistoryData from '../mi1-rare-disease/searchHistory.json'       //test data until api is working
// import Split from 'split.js'
const axios = require('axios')
const headers = {
    'Access-Control-Allow-Origin': '*'
}
const apiURL = "https://dev_api.mi1.ai/api/"
// const apiURL = "http://35.153.231.184/api/"
var view, inputVal
var searchOptions: any[] = []
var searchHistoryData
var mySplit
var loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris placerat lacus eu nisi ultrices congue. Praesent venenatis at lorem sed maximus. Suspendisse potenti. Donec sit amet sem quis ante imperdiet vehicula vel et risus. Nullam nisi urna, facilisis in rutrum id, suscipit vulputate ligula. Vestibulum at malesuada lectus, nec tincidunt nunc. Pellentesque porttitor mi id erat posuere, elementum laoreet lorem tristique. Praesent mauris lorem, gravida sit amet semper ac, viverra eu sem.'
// var uniqueFindingCUIs: string[] = [];
var jsonFindingDescriptions: { [key: string]: any }[] = []
var $selectedTerms = $('#selected-terms')
var $bookmarkedDiseasesContainer = $('#bookmarked-diseases-container')
var firstRecord = 1, stepCount = 5, lastRecord = firstRecord + stepCount - 1
let myTheme = EditorView.theme({
    "cm-editor": {
        // fontSize: "18px",
        width: "100%",
        outline: 0,
        border: 0,
        fontFamily: 'Rubik Light, Open Sans'
    },
    ".cm-content": {
        // fontSize: "18px"
    },
    ".cm-activeLine": {
        backgroundColor: "initial"
    },
    ".cm-gutters": {
        display: "none"
    },
    ".cm-scroller": {
        fontFamily: 'Rubik Light, Open Sans'
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        lineHeight: 1.8,
        fontFamily: "Rubik Light, Open Sans",
        textAlign: "left"

    },
    ".cm-tooltip": {
        // fontSize: "14px",
        fontFamily: 'Rubik Light, Open Sans'
    }
}, { dark: false })

//refresh autocomplete list for findings using startsWith phrase
async function fetchAutoCompleteFromAPI(startsWith) {

    let autoCompleteData = []

    if (startsWith.length >= 3) {
        const body = {
            "startsWith":
                [
                    {
                        "startsWith": startsWith
                    }
                ]
        }

        // autoCompleteData = autocompleteRareDiseaseData
        await axios.post(apiURL + 'autocomplete_rareDz_findings', body, { headers })
            .then(function (response) {
                let autoCompleteData = response.data
                searchOptions = []

                //add autoComplete API response to autocomplete list. On selection, add tag to selected-terms div and refresh disease data 
                for (var i = 0; i <= autoCompleteData.length - 1; i++) {

                    let cui = autoCompleteData[i].Clinical_Finding_HPO_ID
                    let name = autoCompleteData[i].Clinical_Finding
                    let frequency = null
                    let addClasses = "mini removeable selected " + ($('#search-section').hasClass('positive-search') ? 'positive-finding' : 'negative-finding')
                    searchOptions.push({
                        // info: cui,
                        label: name,
                        type: "finding",
                        apply: () => {
                            view.dispatch({
                                changes: {
                                    from: 0,
                                    to: view.state.doc.length,
                                    insert: ''
                                }
                            })
                            createTag($selectedTerms, name, cui, frequency, addClasses, fetchDiseases)
                            $('#div-selected-terms').toggleClass('d-none', false)

                        }
                    })
                }
            }).catch(function (error) { console.log(error) }).then(function () { })
    }
}

//populates autocomplete searchoptions using disease findings
function fetchAutoCompleteFromDiseaseFindings(contains) {
    searchOptions = []
    let $divFindings = $('#suggestions-container .selection-tag')
    let allFindings = []
    $divFindings.each(function (i, obj) {
        let cui = $(obj).find('.selection-tag-cui').text()
        let label = $(obj).find('.selection-tag-text').text()
        let frequency = $(obj).find('.selection-tag-frequency').text()
        let addClasses = "mini removeable selected " + ($('#search-section').hasClass('positive-search') ? 'positive-finding' : 'negative-finding')

        if (!searchOptions.some(e => { if (e.info == cui && e.label == label) { return true } }) && label.toLowerCase().indexOf(contains.toLowerCase()) >= 0) {
            searchOptions.push({
                info: cui,
                label: label,
                apply: () => {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: ''
                        }
                    })
                    createTag($selectedTerms, label, cui, frequency, addClasses, fetchDiseases)
                }
            })
        }
    })
}

//overrides code mirror completion event (i.e. when autocomplete suggestion is selected)
function myCompletions(context: CompletionContext) {

    let word = view.state.doc.toString();       //get content of editor

    //If <3 characters entered, populate autocomplete suggestions with unique list of findings associated with the current set of diseases
    if (word.length < 3) {
        if ($('#suggestions-container .selection-tag').length > 0) {
            fetchAutoCompleteFromDiseaseFindings(word)
        }
        else {
            searchOptions = []
            return null
        }
    }
    //>=3 characters so get autocomplete suggestions from API
    else {
        fetchAutoCompleteFromAPI(word)
    }

    return {
        from: 0,
        options: searchOptions
    }
}

let state = EditorState.create({
    doc: "Press Ctrl-Space in here...\n",
    extensions: [basicSetup, autocompletion({ override: [myCompletions], defaultKeymap: true }),
    ]
})


//returns Diseases based on selected CUIS
async function fetchDiseases() {
    //initiate arrays for getting delta of new finding CUIs
    let uniqueFindingCUISDelta = {}
    let arrSource = getArrayFromJson(jsonFindingDescriptions, 'HPO_ID')

    let cuiArrayPromise = new Promise(function (resolve) {
        sortSearchTerms()
        var matchedFindings: any[] = []
        var negativeMatchedFindings: any[] = []

        //iterate through all the tags in the selected-terms div to get the cuis
        let $selectedTags = $('#selected-terms .selection-tag.selected:not(.d-none)')
        if ($selectedTags.length > 0) {
            $selectedTags.each(function (i, obj) {
                if ($(obj).hasClass('positive-finding')) {
                    matchedFindings.push({
                        HPO_ID: $(obj).find('.selection-tag-cui').text()
                    })
                }
                else {
                    negativeMatchedFindings.push({
                        HPO_ID: $(obj).find('.selection-tag-cui').text()
                    })
                }
            })
        }
        //resolve promise with parameter values for either 
        resolve(
            {
                // CUIs: matchedFindings
                Matched_Findings: matchedFindings,
                Negative_Matched_Findings: negativeMatchedFindings
            }
        )
    })

    //get API call response and display diseases
    await axios.post(apiURL + 'rareDiseaseSearchPosNeg', await (cuiArrayPromise), { headers })
        .then(async function (response) {

            if (response.data.length > 0) {
                showDiseases(response.data, $('#suggestions-container'))
                //populate autocomplete from disease findings
                fetchAutoCompleteFromDiseaseFindings('')
                $('.popover').hide()
            }
            else {
                clearScreen()
            }
        }).then(async function () {     //get new finding descriptions using delta of all CUIs from last API call (arrSource) against all CUIs currently displayed (arrTarget)
            let arrTarget = getTextArrayFromElements('selection-tag-cui', $('#suggestions-container'))
            uniqueFindingCUISDelta = getDeltaOfArraysAsJson(arrSource, arrTarget, 'HPO_ID')
            // let listOfFindings = getCommaSeparatedListFromArray(uniqueFindingCUISDelta)
            // const body = {
            //     "FindingsToDefine":
            //         [
            //             uniqueFindingCUISDelta
            //         ]
            // }
            await axios.post(apiURL + 'findingsDefinitions', uniqueFindingCUISDelta, { headers }).then(async function (response) {
                jsonFindingDescriptions = jsonFindingDescriptions.concat(response)
            })
            // uniqueFindingCUIs=uniqueFindingCUIs.concat(uniqueFindingCUISDelta)
        }).catch(function (error) {
            console.log('api error: ' + error)
            clearScreen()
        })
    // return focus to codemirror input
    view.focus
    try {
        startCompletion
    }
    catch (ex) {
        console.log(console.log(ex))
    }
}

//create a findings tag with click event. This has a call back function to ensure api call is done only on completion of tag creation
function createTag(parentElement, label, id, frequency, addClasses, callback) {
    //clone template to get new tag object
    let $divTag = $('#selection-tag-template').clone().removeAttr('id').removeClass('d-none')
    let scrollToSelection = (parentElement.parents('#suggestions-container').length > 0)
    //populate tag with data
    $divTag.find('.selection-tag-text').text(label)
    $divTag.find('.selection-tag-cui').text(id)
    $divTag.find('.selection-tag-frequency').text(frequency)

    //set frequency indicator by changing width and position of 'empty box' element which is designed to conceal a proportion of the gradient inversely related to the frequency
    let objFrequency = getFrequencyScale(frequency)
    // $divTag.children('.selection-tag-frequency').css('background-color', 'rgba(0,0,0,' + (objFrequency.value) / 5 + ')')
    $divTag.find('.gradient-bar').attr('title', objFrequency.description + ": " + objFrequency.range)
    $divTag.find('.empty-box').attr('title', objFrequency.description + ": " + objFrequency.range)
    $divTag.find('.empty-box').css('width', ((1 - frequency) * 4.5) + .0625 + 'em')
    $divTag.find('.empty-box').css('margin-left', ((1 - frequency) * -4.5) - .0625 + 'em')  //make 1px adjustment to allow for border width
    // $divTag.find('.finding-description').text(loremIpsum.substring(0, loremIpsum.split(' ', Math.ceil(Math.random() * 72)).join(' ').length))
    $divTag.find('.finding-source').text('Source: Orphanet & HPO')
    //add any additional classes
    $divTag.addClass(addClasses)

    //add events to non-matched disease findings tags
    if ($divTag.hasClass('selectable') && !$divTag.hasClass('removeable')) {
        //add click event to pos/neg option

        $divTag.find('.selection-tag-posneg').on("click", function (e) {
            if ($(e.target).hasClass('positive-finding')) {
                addTagToSearchAndRequery($(e.target).parents('.selection-tag').next(), 'positive-finding')
            }
            else {
                addTagToSearchAndRequery($(e.target).parents('.selection-tag').next(), 'negative-finding')

            }
        })
    }

    //add hover event to expand/contract tag for desktops
    if (!window.matchMedia("(hover: none)").matches) {
        $divTag.find('.findings-header').on('mouseenter', function (e) {
            let $currentTag = $(e.currentTarget).parents('.selection-tag')
            if (!($currentTag.hasClass('mini') || $currentTag.hasClass('expanded'))) {
                //if (!($currentTag.hasClass('expanded'))) {
                expandTag($currentTag)
            }
        })

        $divTag.find('.findings-header').on('mouseleave', function (e) {
            let $currentTag = $(e.currentTarget).parents('.selection-tag')
            if ($currentTag.hasClass('expanded')) {
                $('.selection-tag.expanded').remove()
            }
        })
    }

    //add click event to tag label text
    $divTag.find('.selection-tag-text').on('click', function (e) {
        // e.stopPropagation()
        //if the tag is already a search term, remove tag from search terms and requery, otherwise add tag to search terms and requery
        e.stopPropagation()
        let $currentTag = $(e.currentTarget).parents('.selection-tag')
        if ($currentTag.hasClass('removeable')) {
            $('#selected-terms .selection-tag').filter(function (i2, e2) { return $(e2).find('.selection-tag-cui').text() == $currentTag.find('.selection-tag-cui').text() }).remove()
            fetchDiseases()
        }
        else if (!$currentTag.hasClass('selected')) {
            if (window.matchMedia("(hover: none)").matches) {
                expandTag($currentTag)

            }
            else {
                // expandTag($currentTag)
                addTagToSearchAndRequery($currentTag.next(), 'positive-finding')        //next element is tag hidden beneath the expanded tag
            }
        }
    });
    // }


    //update popover caption
    updateTagTitle($divTag)
    //append tag to either search terms on disease findings
    parentElement.append($divTag)
    //perform callback where applicable
    if (callback) {
        callback()
    }
}

//expand findings tag to show description
function expandTag($currentTag) {
    let minWidth
    $('.selection-tag.expanded').remove()
    if ($(window).width()! < 897) {
        minWidth = 250
    }
    else {
        minWidth = 380
    }
    let width = parseInt($currentTag.outerWidth(), 10) <= minWidth ? minWidth + 'px' : parseInt($currentTag.outerWidth(), 10)
    let $currentTagClone = $currentTag.clone(true)
    let HPO_ID = $currentTagClone.find('.selection-tag-cui').text()
    $currentTagClone.addClass('expanded')
    // $currentTagClone.removeClass('top-eight')
    // $currentTagClone.replace
    // $currentTagClone.insertAfter($currentTag.prev())
    $currentTagClone.insertBefore($currentTag)
    var offset = $currentTagClone.offset()
    if (!$currentTagClone.hasClass('selected')) {
        $currentTagClone.find('.selection-tag-posneg').removeClass('d-none').addClass('d-flex')
    }
    $currentTagClone.find('.finding-description, .finding-source').removeClass('d-none').addClass('d-flex')
    $currentTagClone.find('.finding-description').text(getFindingsText(HPO_ID))

    $currentTagClone.find('.selection-tag-text').removeClass('text-truncate')
    var offsetLeft = offset.left + 15 + parseInt(width.toString(), 10) > $(window).width()! ? $(window).width()! - parseInt(width.toString(), 10) - 15 : offset.left
    $currentTagClone.css({
        'position': 'absolute',
        'top': offset?.top - 14,
        'left': offsetLeft,
        'width': width,
        'flex-direction': 'column'
    })
    //update popover caption
    updateTagTitle($currentTagClone)

}
//adds a tag to the search criteria as either a positive or negative finding
function addTagToSearchAndRequery($divTag, addClass) {
    // let $myTag = $target.parents('.selection-tag').clone(true)
    let scrollToSelection = ($divTag.parents('#suggestions-container').length > 0)
    let parentDiseaseName = $divTag.parents('.div-suggestion').find('.disease-name').text()

    let $divTagClone = $divTag.clone(true)
    $divTagClone.removeClass('selectable top-eight white-shadow black-shadow positive-finding negative-finding')
    $divTagClone.addClass('mini removeable selected ' + addClass)

    // append tag to search terms
    updateTagTitle($divTagClone)
    $selectedTerms.append($divTagClone)

    //requery
    // fetchDiseases()
    fetchDiseases().then(function () {

        //scroll screen to suggestion
        if (scrollToSelection) {
            $('html, body').animate({
                scrollTop: $('#suggestions-container .div-suggestion').filter(function (i, e) {
                    return $(e).find('.disease-name').text() == parentDiseaseName
                }).offset()!.top - 225
            }, 0, "easing");
        }
        // else {
        //     $('html, body').animate({
        //         scrollTop: $('#bookmarked-diseases-container .div-suggestion').filter(function (i, e) {
        //             return $(e).find('.disease-name').text() == $target.parents('.div-suggestion').find('.disease-name').text()
        //         }).offset().top - 225
        //     }, 500);
        // }
    })

}

//adds a mouseover caption to the tag text
function updateTagTitle($divTag) {
    let textTitle = ''
    if ($divTag.hasClass('selectable') && !$divTag.hasClass('selected')) {
        // textTitle = 'Click to Add to Search Terms as Positive Finding.'
        // textTitle = 'Click to expand.'
    }
    else if ($divTag.hasClass('removeable')) {
        textTitle = 'Click to Remove from Search Terms'
    }
    else if ($divTag.hasClass('positive-finding selected')) {
        textTitle = 'Positive Finding used in Search Terms'
    }
    else if ($divTag.hasClass('negative-finding selected')) {
        textTitle = 'Negative Finding used in Search Terms'
    }

    $divTag.find('.selection-tag-text').attr('title', textTitle)
}

//sort search terms by pos/neg and then alphabetically
function sortSearchTerms() {

    var mylist = $selectedTerms;
    var posFindings = mylist.children('.selection-tag.positive-finding').get();
    var negFindings = mylist.children('.selection-tag.negative-finding').get();

    //sort positive findings
    posFindings.sort(function (a, b) {
        return $(a).find('.selection-tag-text').text().toUpperCase().localeCompare($(b).find('.selection-tag-text').text().toUpperCase());
    })
    $.each(posFindings, function (i, obj) {
        mylist.append(obj);
    });

    // sort negative findings
    negFindings.sort(function (a, b) {
        return $(a).find('.selection-tag-text').text().toUpperCase().localeCompare($(b).find('.selection-tag-text').text().toUpperCase());
    })
    $.each(negFindings, function (i, obj) {
        mylist.append(obj);
    });
}

//display output from api call showing returned diseases with associated evidence displayed as tags
function showDiseases(data, $parentContainer) {

    let diseaseFindings = []
    searchOptions = []      //global array

    $('#primary-container').removeClass('is-empty')
    //get list of bookmarked diseases
    var bookmarkedDiseaseNames = $bookmarkedDiseasesContainer.find('.disease-name').map(function () {
        return $(this).text()
    }).get()

    //get list of all suggestions with show findings expanded
    var showFindings = $('#suggestions-container .div-suggestion.show-findings .disease-name').map(function () {
        return $(this).text()
    }).get()

    $('#suggestions-container').empty()

    // populate suggestion-template with disease data and add to suggestions-container div
    try {
        for (let arrIndex = 0; arrIndex < data.length; arrIndex++) {
            let diseaseItem = data[arrIndex]
            let diseaseTag = diseaseItem.Disease.replaceAll(' ', '_')
            let $divSuggestion = $('#suggestion-template').clone().removeAttr('id').removeClass('d-none').addClass(diseaseTag)
            // let $divSuggestion = $('#suggestion-template').clone().attr('id', diseaseItem.Disease_CUI).removeClass('d-none')
            $divSuggestion.attr('cui', diseaseItem.Disease_CUI)
            $divSuggestion.find('.disease-name').text(diseaseItem.Disease)

            $divSuggestion.find('.disease-info').text(diseaseItem.Disease_Definition)
            $divSuggestion.find('.disease-info').attr('title', diseaseItem.Disease_Definition)

            // let probability = Math.round(Math.abs(obj.Disease_Probability)) + '%'
            let probability = Math.round(diseaseItem.Disease_Probability)
            $divSuggestion.find('.disease-probability').text(probability)

            // prevalence measures
            let diseasePrevalence = diseaseItem.Disease_Prevalence || 0
            let diseaseAnnualIncidence = diseaseItem.Disease_Annual_Incidence || 0
            let diseaseBirthPrevalence = diseaseItem.Disease_Birth_Prevalence || 0
            let diseaseLifetimePrevalence = diseaseItem.Disease_Lifetime_Prevalence || 0
            let diseasePointPrevalence = diseaseItem.Disease_Point_Prevalence || 0
            //display max of these prevalences in label
            // let maxPrevalence = Math.max(diseasePrevalence, diseaseAnnualIncidence, diseaseBirthPrevalence, diseaseLifetimePrevalence, diseasePointPrevalence)
            let maxPrevalence = diseaseItem.Max_Prevalence_or_Incidence || 0

            let objDiseasePrevalence = getPrevalenceScale(diseasePrevalence || 0)
            let objDeaseAnnualIncidence = getPrevalenceScale(diseaseAnnualIncidence || 0)
            let objDeaseBirthPrevalence = getPrevalenceScale(diseaseBirthPrevalence || 0)
            let objDeaseLifetimePrevalence = getPrevalenceScale(diseaseLifetimePrevalence || 0)
            let objDiseasePointPrevalence = getPrevalenceScale(diseasePointPrevalence || 0)

            let $prevalence = $divSuggestion.find('.disease-prevalence')
            var prevelanceRange


            if (maxPrevalence == 0) {
                $prevalence.addClass('not-known')
                // prevelanceRange = "Prevalence Not Known"
            }
            else {
                let objPrevalence = getPrevalenceScale(maxPrevalence)
                prevelanceRange = objPrevalence.range_numerator + ' / ' + objPrevalence.range_denominator.toLocaleString()


                let prevalenceTitleContent =
                    formatPrevalenceLine('Prevalence', objDiseasePrevalence) +
                    formatPrevalenceLine('Annual Incidence', objDeaseAnnualIncidence) +
                    formatPrevalenceLine('Point Prevalence', objDiseasePointPrevalence) +
                    formatPrevalenceLine('Birth Prevalence', objDeaseBirthPrevalence) +
                    formatPrevalenceLine('Lifetime Prevalence', objDeaseLifetimePrevalence)

                // if (!isNaN(floatPrevalence)) {
                // $divSuggestion.find('.disease-prevalence').css('background-color', 'rgba(0,0,0,' + (objPrevalence.value) / 5 + ')')
                // $prevalence.attr('title', prevalenceTitle)
                $prevalence.popover("dispose")
                $prevalence.popover({
                    title: "Prevalence",
                    content: prevalenceTitleContent,
                    trigger: "hover",
                    placement: "left",
                    html: true,
                    customClass: "prevalence-title"
                    // template: '<div class="popover" role="tooltip">' +
                    //     '<div class="popover-arrow"> </div>' +
                    //     '<h3 class="popover-header"> </h3 >' +
                    //     '<div class="popover-body"> </div > </div > '
                })
                $prevalence.text(prevelanceRange)
            }

            //publications
            let evidence = diseaseItem.Disease_Finding_Assoc_Evidence
            let publicationsHtmlString = '';
            if (evidence != null) {
                for (let j = 0; j < evidence.length; j++) {
                    let url = evidence[j]
                    publicationsHtmlString += '<a class="publication-url" href=' + url + ' target="_blank">' + (j + 1)
                }
                publicationsHtmlString = "Publications:" + publicationsHtmlString
            }

            //connected papers
            $divSuggestion.find('.connected-papers').attr('title', 'Search Connected Papers for ' + diseaseItem.Disease)
            $divSuggestion.find('.connected-papers').on("click", function (el) {
                let url = "https://www.connectedpapers.com/search?q=" + diseaseItem.Disease
                window.open(url, '_blank').focus();
            })
            // $divSuggestion.find('.associated-evidence').attr('data-bs-original-title', publicationsHtmlString)
            if (publicationsHtmlString == '') {
                $divSuggestion.find('.disease-evidence').hide()
            }
            else {
                $divSuggestion.find('.disease-evidence').append(publicationsHtmlString)
            }

            $divSuggestion.find('.expand-contract').on("click", function (e) {
                $(e.currentTarget).parents('.div-suggestion').toggleClass('contracted');
            })

            //add click event to expand disease info
            $divSuggestion.find('.disease-info').on('click', function (e) {
                let $suggestion = $(e.currentTarget)
                $suggestion.toggleClass('abbreviated')
                if ($suggestion.hasClass('abbreviated')) {
                    $suggestion.attr('title', $suggestion.text())
                }
                else {
                    $suggestion.removeAttr('title')
                }
            })

            //check if bookmark should be active
            if (bookmarkedDiseaseNames.indexOf(diseaseItem.Disease) > -1) {
                $divSuggestion.find('.disease-bookmark').addClass('active').toggleClass('fas far')
            }

            //populate findings div for diagnosis and associated findings div for top 3 diagnoses
            //create isMatched property and concatenate matched and unmatched findings
            if (typeof diseaseItem.Matched_Findings !== 'undefined') {
                diseaseItem.Matched_Findings.forEach(function (element) {
                    // element.IsMatched = "true";
                    element.Rank = 2 + element.Frequency
                    element.TypeOfFinding = "Matched"
                })
                diseaseFindings = diseaseItem.Matched_Findings
            }

            if (typeof diseaseItem.Unmatched_Findings !== 'undefined') {
                diseaseItem.Unmatched_Findings.forEach(function (element) {
                    // element.IsMatched = "false";
                    element.Rank = element.Frequency
                    element.TypeOfFinding = "Unmatched"
                })
                diseaseFindings = diseaseFindings.concat(diseaseItem.Unmatched_Findings)
            }

            if (typeof diseaseItem.Neg_Matched_Findings !== 'undefined') {
                diseaseItem.Neg_Matched_Findings.forEach(function (element) {
                    // element.IsMatched = "false";
                    element.Rank = 1 + element.Frequency
                    element.TypeOfFinding = "NegativeMatched"
                })
                diseaseFindings = diseaseFindings.concat(diseaseItem.Neg_Matched_Findings)
            }

            // sort data by rank
            diseaseFindings.sort(function (a: any, b: any) {
                return (parseFloat(b.Rank) - parseFloat(a.Rank))
            })

            //update findings label
            $divSuggestion.find('.findings-label').text("Findings (" + diseaseFindings.length + ")")

            //show/hide more findings button text
            let btnMoreFindings = $divSuggestion.find('.btn-more-findings')
            if (diseaseFindings.length > 8) {
                //check if suggestion previously had findings expanded to show all
                if (showFindings.indexOf(diseaseItem.Disease) > -1) {
                    btnMoreFindings.text("Show Fewer")
                    $divSuggestion.toggleClass('hide-findings show-findings')
                }
                else {
                    btnMoreFindings.text("Show All")
                }
            }
            else {
                btnMoreFindings.hide()
            }

            //iterate through findings
            if (diseaseFindings != null) {
                for (let j = 0; j < diseaseFindings.length; j++) {
                    let obj: any = diseaseFindings[j]
                    let label = obj.Name
                    let cui = obj.HPO_ID
                    let frequency = obj.Frequency
                    let addClasses = ""
                    if (obj.TypeOfFinding == "NegativeMatched") {
                        addClasses = "negative-finding "
                    }
                    else {
                        addClasses = "positive-finding "
                    }

                    //add 'selected' class if cui is returned in matched-findings array (ie it was used in the search terms )
                    addClasses += ((obj.TypeOfFinding == "Matched" || obj.TypeOfFinding == "NegativeMatched") ? "selected removeable " : "selectable ")

                    //add top-eight class for top 8 findings. These will always be displayed
                    if (j < 8) {
                        addClasses += "top-eight "
                    }
                    //add ellipsis after 8th finding
                    if (j == 8 && diseaseFindings.length > 8) {
                        $divSuggestion.find('.disease-findings').append("<span class='ellipsis'></span>")
                        if ($divSuggestion.hasClass('show-findings')) {
                            $divSuggestion.find('.ellipsis').hide()
                        }
                    }
                    //add tag to the disease findings container
                    createTag($divSuggestion.find('.disease-findings'), label, cui, frequency, addClasses, null)
                }
            }

            //add click event to show/hide additional findings
            $divSuggestion.find('.btn-more-findings, .ellipsis').on("click", function (e) {
                let $suggestion = $(e.currentTarget).parents('.div-suggestion')
                $suggestion.toggleClass('show-findings hide-findings')
                if ($suggestion.hasClass('show-findings')) {
                    $suggestion.find('.btn-more-findings').text("Show Fewer")
                    $suggestion.find('.ellipsis').hide()
                }
                else {
                    $suggestion.find('.btn-more-findings').text("Show All")
                    $suggestion.find('.ellipsis').show()

                }
            })

            //add click event to add/remove suggestion to bookmark list when bookmark selected/deselected
            $divSuggestion.find('.disease-bookmark').on("click", function (e) {
                let $suggestion = $(e.currentTarget).parents('.div-suggestion')
                var $bookmarkIcon = $('.' + diseaseTag + ' .disease-bookmark')      //include suggestions in both the bookmarked list and diseases list

                $bookmarkIcon.toggleClass('active')
                $bookmarkIcon.toggleClass('fas far')

                if ($bookmarkIcon.hasClass('active')) {
                    let $divSuggestionClone = $suggestion.clone(true).addClass('contracted')        //clone elements and events
                    $bookmarkedDiseasesContainer.append($divSuggestionClone)
                }
                else {
                    $bookmarkedDiseasesContainer.find('.' + diseaseTag).remove()
                }
                showHideBookmarksContainer()
            })

            //append this new div-suggestion to the parent container
            $parentContainer.append($divSuggestion)

        }
        updateBookmarkFindings()

    }
    catch (ex) {
        console.log(console.log(ex))
    }
}

//update findings for bookmarked results based on current search criteria
function updateBookmarkFindings() {
    //update bookmark findings with appropriate class if this is in search terms
    $bookmarkedDiseasesContainer.find('.div-suggestion').each(function (i, e) {
        let $divSuggestion = $(e)
        let $divTags = $divSuggestion.find('.selection-tag:visible')
        let $diseaseFindings = $divSuggestion.find('.disease-findings')
        $divTags.each(function (i2, e2) {
            let $divTag = $(e2)
            let rank = parseFloat($divTag.find('.selection-tag-frequency').text())

            //look for bookmarked finding in selected terms
            let $selectedTerm = $selectedTerms.find('.selection-tag').filter(function (i3, e3) { return $(e3).find('.selection-tag-cui').text() == $divTag.find('.selection-tag-cui').text() })
            // if ($selectedTerms.find('.selection-tag-cui').text().indexOf($(e).text()) > -1) {
            if ($selectedTerm.length > 0) {
                $divTag.addClass('selected removeable')
                $divTag.removeClass('selectable')

                //positive finding
                if ($selectedTerm.hasClass('positive-finding')) {
                    $divTag.addClass('positive-finding')
                    $divTag.removeClass('negative-finding')
                    rank += 2
                }
                //negative finding
                else {
                    $divTag.addClass('negative-finding')
                    $divTag.removeClass('positive-finding')
                    rank += 1
                }

            }
            //not in selected terms so remove positive/negative findings classes 
            else {
                $divTag.removeClass('selected removeable positive-finding negative-finding')
                $divTag.find('.selection-tag-posneg .positive-finding, .selection-tag-posneg .negative-finding').off("click")
            }

            $divTag.attr('rank', rank)
        })

        // sort findings by rank
        let $divTagsSorted = sortElementsDesc($divTags.clone(true), 'rank')

        //add top-eight class to first eight findings and prepend all findings to disease findings container
        $divTagsSorted.removeClass('top-eight')
        $divTagsSorted.slice(0, 8).addClass('top-eight')
        $divTags.remove()
        $divTagsSorted.prependTo($diseaseFindings)
    })
}

//sort list of jquery elements on attrName
function sortElementsDesc($items, attrName) {
    return $($items.toArray().sort(function (a, b) {
        var aVal = parseInt(a.getAttribute(attrName)),
            bVal = parseInt(b.getAttribute(attrName));
        return bVal - aVal;
    }));
}

//hide bookmarks container if there are no bookmarks to display
function showHideBookmarksContainer() {
    if ($('#bookmarked-diseases-container .div-suggestion').length == 0) {
        $('#bookmarked-diseases-container, #rda-header-bookmarked-diseases').toggleClass('d-none', true)
        // $('#rda-header-diseases').css('top', '-=50')
    }
    else {
        $('#bookmarked-diseases-container, #rda-header-bookmarked-diseases').toggleClass('d-none', false)
        // $('#rda-header-diseases').css('top', '255px')
    }
}

//return a single line for the prevalence popover given the label and value
function formatPrevalenceLine(label, objValue) {
    if (objValue.value == 0) { return '' }
    else {
        return "<div><span class='prevalence-label'>" + label + "</span><span class='prevalence-range'>" +
            objValue.range_numerator + ' / ' + objValue.range_denominator.toLocaleString() + "</span></div>"
    }
}

//clear screen (clearing selected terms is optional)
function clearScreen(clearSelectedTerms = false) {
    if (clearSelectedTerms) {
        $selectedTerms.empty()
        $('#div-selected-terms').toggleClass('d-none', true)
    }

    $('#suggestions-container').empty()
    // $('#bookmarked-diseases-container').empty()
    $('#primary-container').addClass('is-empty')
    $('.search-editor, #search-history-icon').toggleClass('d-none', false)
    // $('#search-history').toggleClass('d-none', true)

    //clear cm editor
    view.dispatch({
        changes: {
            from: 0,
            to: view.state.doc.length,
            insert: ''
        }
    })
    view.focus()
}

//receives frequency as input. Returns object representing prevalence on a scale from 1-5
function getFrequencyScale(frequency) {
    let frequency_description = ''
    let frequency_value = 0
    let frequency_range = ''
    let frequency_range_floor = 0
    let frequency_range_ceiling = 0

    if (frequency <= .025) {
        frequency_description = 'Very Rare'
        frequency_value = 1
        frequency_range_floor = 1
        frequency_range_ceiling = 4
        frequency_range = '1-4%'
    }
    else if (frequency <= 0.29) {
        frequency_description = 'Occasional'
        frequency_value = 2
        frequency_range_floor = 5
        frequency_range_ceiling = 29
        frequency_range = '5-29%'
    }
    else if (frequency <= 0.79) {
        frequency_description = 'Frequent'
        frequency_value = 3
        frequency_range_floor = 30
        frequency_range_ceiling = 79
        frequency_range = '30-79%'
    }
    else if (frequency <= (0.99)) {
        frequency_description = 'Very Frequent'
        frequency_value = 4
        frequency_range_floor = 80
        frequency_range_ceiling = 99
        frequency_range = '80-99%'
    }
    else {
        frequency_description = 'Obligate'
        frequency_value = 5
        frequency_range_floor = 100
        frequency_range_ceiling = 100
        frequency_range = '100%'
    }

    return {
        'value': frequency_value,
        'description': frequency_description,
        'range': frequency_range,
        'range_floor': frequency_range_floor,
        'range_ceiling': frequency_range_ceiling
    }
}

//receives prevalance as input. Returns object representing prevalence on a scale from 1-5
function getPrevalenceScale(prevalence) {
    let prevalence_description = ''
    let prevalence_value = 0
    let prevalence_range_numerator = ''
    let prevalence_range_denominator = 0

    if (prevalence == 0) {
        prevalence_range_numerator = ''
        prevalence_range_denominator = 0
        prevalence_value = 0
    }
    // else if (prevalence = Math.pow(10, -6)) {
    else if (prevalence <= 1 / 1000000) {
        prevalence_range_numerator = '< 1'
        prevalence_range_denominator = 1000000
        prevalence_value = 1
    }
    // else if (prevalence = (1 + 9) / 2 * Math.pow(10, -6)) {
    else if (prevalence <= (1 + 9) / 2 / 1000000) {
        prevalence_range_numerator = '1-9'
        prevalence_range_denominator = 1000000
        prevalence_value = 2
    }
    else if (prevalence <= (1 + 9) / 2 / 100000) {
        prevalence_range_numerator = '1-9'
        prevalence_range_denominator = 100000
        prevalence_value = 3
    }
    else if (prevalence <= (1 + 5) / 2 / 10000) {
        prevalence_range_numerator = '1-5'
        prevalence_range_denominator = 10000
        prevalence_value = 4
    }
    else if (prevalence <= (6 + 9) / 2 / 10000) {
        prevalence_range_numerator = '6-9'
        prevalence_range_denominator = 10000
        prevalence_value = 5
    }
    else if (prevalence <= 1 / 1000) {
        prevalence_range_numerator = '>1'
        prevalence_range_denominator = 1000
        prevalence_value = 6
    }

    return {
        'value': prevalence_value,
        'description': prevalence_description,
        'range_denominator': prevalence_range_denominator,
        'range_numerator': prevalence_range_numerator
    }
}

//show hide search records depending on favourites toggle
function toggleFavourites() {
    firstRecord = 1
    refreshSearchHistory()
}

//render search history records held in searchHistoryData object
function refreshSearchHistory() {
    var $searchHistoryLine = $(), $divTag = $()
    var searchDate, searchTime, oldSearchDate, longDate, shortDate
    var showFavourites = $('#rda-header-search-history .save-icon').hasClass('fas')
    var count = 1
    var numRecords, index
    //remove existing history lines
    $('#search-history .search-history-line-template').remove()
    //filter data on favourites if applicable
    if (showFavourites) {
        numRecords = searchHistoryData.filter(function (d) {
            return d.saved.toString() == 'true'
        }).length
    }
    else {
        numRecords = searchHistoryData.length
    }
    //calculate index of lastRecord to be displayed on page.
    lastRecord = firstRecord + stepCount - 1 > numRecords ? numRecords : firstRecord + stepCount - 1
    //iterate through json data, ignoring records that don't belong on the page or have been filtered out
    $(searchHistoryData.slice(firstRecord - 1)).each(function (i, d) {
        index = firstRecord + i - 1
        if (showFavourites == false || d.saved == 'true') {
            $searchHistoryLine = $('#search-history-line-template').clone(true).removeAttr('id')

            searchDate = new Date(d.datetime).toLocaleDateString()
            searchTime = new Date(d.datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: "true" })

            //hide date header if not applicable
            // $searchHistoryLine.find('.date-header').text(new Date(d.datetime).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "2-digit", year: "numeric" }))
            longDate = new Date(d.datetime).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "2-digit", year: "numeric" })
            shortDate = new Date(d.datetime).toLocaleDateString()
            if (searchDate != oldSearchDate || oldSearchDate == undefined) {
                // $searchHistoryLine.prepend("<div class='date-header'>" + formattedDate + "</div>")
                // $searchHistoryLine = $("<span class='date-header'>" + formattedDate + "</span>").append($searchHistoryLine)
                $searchHistoryLine.find('.date-header').text(longDate)
                $searchHistoryLine.find('.date-header').attr('id', shortDate)
            }
            else {
                $searchHistoryLine.find('.date-header').remove()
            }

            $searchHistoryLine.find('.search-time').text(searchTime)

            //make save icon solid or regular depending on saved flag
            if (d.saved.toString() == "true") {
                $searchHistoryLine.find('.save-icon').addClass('fas')
                $searchHistoryLine.find('.save-icon').removeClass('far')
            }
            else {
                $searchHistoryLine.find('.save-icon').addClass('far')
                $searchHistoryLine.find('.save-icon').removeClass('fas')
            }

            //add findings tags
            $(d.searchTerms).each(function (i2, d2) {
                $divTag = $("<span class='tag'>" + d2.name + "</span>")
                $divTag.data('cui', d2.cui)
                $divTag.addClass(d2.posneg == 'pos' ? 'positive-search' : 'negative-search')
                $searchHistoryLine.find('.search-history-line-findings').append($divTag)
            })

            //store index number in attribute of save icon
            $searchHistoryLine.find('.save-icon').attr('index', index)

            //append searchHistoryLine to div
            if ($searchHistoryLine.find('.date-header').length > 0) {
                $('#search-history-lines').append($searchHistoryLine)
            }
            else {
                $('#search-history-lines .search-history-line-template').last().append($searchHistoryLine.find('.search-history-line-group'))
            }

            //add event to trigger search when line is clicked
            $('#search-history .search-history-line-findings').off().on("click", function (e) {
                $selectedTerms.empty()
                var addClasses
                $(e.currentTarget).children('.tag').each(function (i, t) {
                    addClasses = "mini removeable selected " + ($(t).hasClass('positive-search') ? 'positive-finding' : 'negative-finding')
                    createTag($selectedTerms, $(t).text(), $(t).data("cui"), null, addClasses, null)
                })
                $('#div-selected-terms').toggleClass('d-none', false)
                fetchDiseases()
                //hide search for smaller devices
                if ($(window).width()! < 897) {
                    toggleSearchHistory(true)
                }

            })

            oldSearchDate = searchDate
            count++
            //break out of loop if page has been generated
            if (count > stepCount) { return false }
        }
    })
    // var numRecords = $('.search-history-line-group:not(.d-none)').length
    $('#search-history-navbar').text(Math.ceil(firstRecord / stepCount) + " of " + Math.ceil(numRecords / stepCount))
    $('#previous-record').attr('disabled', firstRecord == 1)
    $('#next-record').attr('disabled', lastRecord == numRecords)
}

//show/hide search history panel
function toggleSearchHistory(hidePanel) {
    var searchHistoryWidth
    if (hidePanel == 'toggle') {
        if ($('#search-history-container').width() == 0) {
            hidePanel = false
        }
        else {
            hidePanel = true
        }
    }

    $('#search-history-container').toggleClass('slide-in slide-out')
    if (mySplit != undefined) {
        mySplit.destroy()
    }
    // $('.gutter.gutter-horizontal').toggleClass('d-none', true)

    if (hidePanel) {
        // mySplit = Split(['#search-history-container', '#results-container'], {
        //     sizes: [0, 100],
        //     minSize: 0,
        //     expandToMin: false,
        //     gutterSize: 1,
        //     gutterAlign: 'center',
        //     snapOffset: 30,
        //     dragInterval: 1,
        //     direction: 'horizontal',
        //     cursor: 'col-resize',
        // })
        // $('.gutter.gutter-horizontal').fadeOut(600)
        $('#search-history-container').css({
            'width': '0px',
            'padding': '0px',
            'opacity': 0,
            'transition': 'width .6s'
        })
        $('#results-container').css({
            'width': '98vw',
            'border-left': 'none',
            'display': 'initial'
        })
        // $('body').css({
        //     'overflow-y': 'hidden'
        // })
        $('#search-history-container').fadeOut({
            'duration': 600,
            'queue': 'false'
        })

    }
    else {
        // mySplit = Split(['#search-history-container', '#results-container'], {
        //     sizes: [30, 70]
        //     // minSize: 480
        // })
        // $('#search-history-container').removeClass('d-none')
        // $('.gutter.gutter-horizontal').fadeIn(600)
        // $('#search-history-container').css('transition', '')    //switch off transition once faded in
        if ($(window).width()! < 897) {
            $('#search-history-container').css({
                'width': '100vw',
                'padding': '0',
                'opacity': 1,
                'transition': '.6s'
            })
            $('#results-container').css({
                // 'width': 0,
                // 'padding': '0',
                // 'border-left': 'none',
                'transition': '.6s',
                'display': 'none'

            })

        }
        else {
            $('#search-history-container').css({
                'width': '40vw',
                'padding': '0 2em',
                'opacity': 1,
                'transition': '.6s'
            })
            $('#results-container').css({
                'width': '60vw',
                'border-left': '5px solid grey',
                'transition': '.6s'

            })
        }
        // $('body').css({
        //     'overflow-y': 'auto'
        // })

        $('#search-history-container').fadeIn({
            'duration': 600,
            'queue': 'false'
        })
    }

}

function showHideImageDescriptions(showDescriptions) {
    if (showDescriptions) {
        $('#navbar-left .image-description').css('display', 'block')
    }
    else {
        $('#navbar-left .image-description').css('display', 'none')
    }
}

//returns an array of the text of all elements of class myClass with a parent object $parent
function getTextArrayFromElements(myClass, $parent) {
    let arr: string[] = []
    $parent.find('.' + myClass).each(function (i, obj) {
        arr.push($(obj).text())
    })
    return arr
}

//returns an array of items that are in arrTarget but not in arrSource
function getDeltaOfArrays(arrSource, arrTarget) {
    let arr: string[] = []
    $.each(arrTarget, function (k, v) {
        if (!arrSource.includes(v)) {
            arr.push(v)
        }
    })
    return arr
}

//returns a json object  of items that are in arrTarget but not in arrSource
function getDeltaOfArraysAsJson(arrSource: any[], arrTarget: any[], key: string) {
    // let jsonArrayObject = { Findings_To_Define: [] };
    // let jsonArrayObject: { label: { [key: string]: any }[] } = { label: [] };
    let jsonArrayObject: { Findings_To_Define: { [key: string]: any }[] } = { Findings_To_Define: [] };
    try {
        arrTarget.forEach((value) => {
            if (!arrSource.includes(value) && !Object.values(jsonArrayObject).includes(value)) {
                jsonArrayObject['Findings_To_Define'].push({ [key]: value });
            }
        })
    }
    catch (e) {
        console.log(e)
    }
    return jsonArrayObject
}

//returns finding from jsonFindingDescriptions object corresponding to HPO_ID parameter
function getFindingsText(HPO_ID) {
    try {
        let definition = jsonFindingDescriptions[0]['data'].filter(data => data['HPO_ID'] == HPO_ID)[0].Definition
        if (definition == null) {
            definition = 'No definition is available.'
        }
        return definition
    }
    catch {
        return 'No definition is available.'
    }
}

//takes an array of strings and returns a single string containing a comma separated list of strings in quotes
function getCommaSeparatedListFromArray(arr) {
    let returnVal = "";
    $.each(arr, function (key, value) {
        returnVal += "'" + value + "',"
    })
    return returnVal
}

//takes a json object and key and returns an array of values corresponding to the given key
function getArrayFromJson(json, key) {
    let arr: string[] = []
    if (typeof json != 'undefined') {
        try {
            $.each(JSON.parse(json), function (k, v) {
                // if (k == key) {
                arr.push(v)
                // }
            })
        }
        catch
        { return [] }

    }

    return arr
}

//code fired after each page load
$(function () {

    particlesJS.load('particles-js', 'particlesjs.json', function () {
        console.log('callback - particles-js config loaded');
    });


    const initialState = EditorState.create({
        doc: '',
        extensions: [
            basicSetup,
            // keymap.of([indentWithTab]),
            myTheme,
            // cursorTooltip(),
            autocompletion({ override: [myCompletions] }),
            // EditorView.lineWrapping,
            // indentUnit.of("\t")
        ],
    })

    // Initialization of the EditorView
    view = new EditorView({
        parent: document.getElementById('editor'),
        state: initialState,
    })

    // //bind Clear All button click event
    // $('#clear-search').on("click", function () {
    //     clearScreen(true)
    //     toggleSearchHistory(true)
    // })

    //bind pos/neg toggle change event
    $('#posneg-state').on("change", function () {
        if (this.checked) {
            $('#search-section').addClass('negative-search')
            $('#search-section').removeClass('positive-search')
        }
        else {
            $('#search-section').addClass('positive-search')
            $('#search-section').removeClass('negative-search')
        }
        view.focus()

    });

    $('.posneg-switch .form-check-label, .posneg-switch .form-check-input').on("mouseenter mouseleave", function (e) {
        $(e.currentTarget).toggleClass('toggle-button-shadow')
        if (!$(e.currentTarget).hasClass('form-check-input')) {
            $('.form-check-input').toggleClass('toggle-button-shadow')
        }
    })

    //contract/expand all bookmarked diseases
    $('#rda-header-bookmarked-diseases').on("click", function (e) {
        $(e.currentTarget).toggleClass('contracted');
        let isContracted = $(e.currentTarget).hasClass('contracted')
        $(e.currentTarget).next().find('.div-suggestion').toggleClass('contracted', isContracted);
    })

    //show/hide search history
    $('#btnSearchHistory, #btnSearchHistoryLeft').on("click", function () {
        toggleSearchHistory('toggle')

        // if (!$('#search-history').hasClass('d-none')) {
        //     refreshSearchHistory()
        // }
    })

    //disable/enable buttons during animation
    $('#search-history-container').on('animationstart webkitAnimationStart', function () {
        $('#btnSearchHistory, #btnSearchHistoryLeft').prop('disabled', 'true')
    });

    $('#search-history-container').on('animationend webkitAnimationEnd', function () {
        $('#btnSearchHistory, #btnSearchHistoryLeft').prop('disabled', 'false')
    });

    $('#btnClearAll, #btnClearAllLeft').on("click", function () {
        clearScreen(true)
        toggleSearchHistory(true)
    })

    $('#search-history-title i').on('click', function () {
        toggleSearchHistory(true)
    })

    //contract/expand all diseases
    $('#rda-header-diseases').on("click", function (e) {
        $(e.currentTarget).toggleClass('contracted');
        let isContracted = $(e.currentTarget).hasClass('contracted')
        $(e.currentTarget).next().find('.div-suggestion').toggleClass('contracted', isContracted);
    })

    //contract/expand search history
    $('#search-history-expand-contract').on("click", function (e) {
        toggleSearchHistory('toggle');
    })

    //add event for search history filter favourites toggle
    $('#show-favourites').on("click", function (e) {
        //make star solid/regular
        $('#rda-header-search-history .save-icon').toggleClass('fas far')
        //show/hide search results
        toggleFavourites()
    })

    $('#next-record').on('click', function () {
        firstRecord = firstRecord + stepCount
        refreshSearchHistory()
    })

    $('#previous-record').on('click', function () {
        firstRecord = firstRecord - stepCount
        if (firstRecord < 0
        ) { firstRecord = 1 }
        refreshSearchHistory()
    })

    $('#left-navbar').on('mouseenter', function () {
        showHideImageDescriptions(true)
    })

    $('#left-navbar').on('mouseleave', function () {
        showHideImageDescriptions(false)
    })


    //add event to toggle saved value when clicking corresponding 'save' icon.
    $('#search-history-line-template .save-icon').on('click', function (e) {
        // $(e.currentTarget).toggleClass('fas far')
        var index = $(e.currentTarget).attr('index')!
        searchHistoryData[index].saved = searchHistoryData[index].saved.toString() == 'true' ? 'false' : 'true'
        refreshSearchHistory()
    })

    //populate search history
    $.getJSON('/searchHistory.json', function (data) {
        searchHistoryData = data.searchHistory
        refreshSearchHistory()
    })

    //hide search history
    toggleSearchHistory(true)

    $('body').on('click', function () {
        $('.selection-tag.expanded').remove();
    });
    //page info popover
    // $('#page-info-popover').popover("dispose")
    // $('#page-info-popover').popover({
    //     title: "",
    //     content: $('#page-info-template').html(),
    //     trigger: "hover",
    //     placement: "auto",
    //     html: true,
    //     customClass: "prevalence-title"
    // })
})

