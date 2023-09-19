import pandas as pd
from neo4j import GraphDatabase, Driver

driver=GraphDatabase.driver(uri="bolt://44.204.154.78:7687", auth=('neo4j', 'NikeshIsCool')) 
session=driver.session()

def findingsDefinitions(HPO_list):
    query='''
    MATCH (n:HPOentity)
    WHERE n.hpo_id IN {HPO_list}
    RETURN n.hpo_id AS HPO_ID, n.definition AS Definition
    '''.format(HPO_list=HPO_list)
    data = session.run(query)
    findingsDefinitions = pd.DataFrame([dict(record) for record in data])
    return findingsDefinitions


def autocomplete_rareDz_findings(startingtext):
    query = '''
    MATCH (h:HPOentity)-[:ASSOC_WITH]->(o:OrphEntity)
    WHERE toLower(h.name) STARTS WITH toLower('{startingtext}')
    RETURN DISTINCT(h.hpo_id) AS `Clinical_Finding_HPO_ID`, h.name AS `Clinical_Finding`
    UNION
    MATCH (c1:Concept)
    MATCH (h2:HPOentity)-[:ASSOC_WITH]->(o2:OrphEntity)
    WHERE toLower(c1.term) STARTS WITH toLower('{startingtext}') and c1.cui = h2.umls_id
    RETURN DISTINCT(h2.hpo_id) AS `Clinical_Finding_HPO_ID`, c1.term AS `Clinical_Finding`
    '''.format(startingtext=startingtext)
    data = session.run(query)
    autocomplete_rareDz_findings = pd.DataFrame([dict(record) for record in data])
    autocomplete_rareDz_findings.sort_values(by='Clinical_Finding', inplace=True)
    return autocomplete_rareDz_findings

def rareDiseaseSearchPosNeg(Matched_Findings, Negative_Matched_Findings):

    # Get a list of the most likely diseases and the data used to calculate likelihood
    query = '''
    MATCH (pos_f:HPOentity)-[given_r:ASSOC_WITH]->(d:OrphEntity)<-[total_r:ASSOC_WITH]-(total_f:HPOentity)
    
    // Get a list of diseases which have at least one finding in the list of CUIs for given findings
    // Filter out any diseases which are excluded by a finding in the list of given findings
    WHERE pos_f.hpo_id IN {Matched_Findings} AND (given_r.diagnostic_criterion_attribute IS NULL OR NOT given_r.diagnostic_criterion_attribute = 'Exclusion_DC')

    // Get lists of positive findings and their relationships to disease
    WITH d.name AS Disease, d.hpo_id AS Disease_CUI, d.definition AS Disease_Definition, d.point_prevalence AS Disease_Point_Prevalence, d.birth_prevalence AS Disease_Birth_Prevalence, d.lifetime_prevalence AS Disease_Lifetime_Prevalence, d.annual_incidence AS Disease_Annual_Incidence, collect(DISTINCT(pos_f.name)) AS Positive_Findings, collect(DISTINCT(pos_f.number_assoc_rare_diseases)) AS Pos_Find_number_assoc_rare_diseases, collect(DISTINCT(COALESCE(pos_f.hpo_id, 'Null'))) AS Pos_Find_HPO_IDs, collect(DISTINCT(total_r)) AS All_Find_Rel, collect(DISTINCT(total_f.name)) AS all_dz_findings, collect(DISTINCT(COALESCE(total_f.hpo_id, 'Null'))) AS all_dz_CUIs, collect(DISTINCT(given_r)) AS Pos_Find_Rel, COLLECT(DISTINCT(pos_f)) AS pos_f, COLLECT(DISTINCT(total_f)) AS total_f

    // Get list of unmatched findings nodes
    WITH [x IN total_f WHERE NOT x in pos_f] as unmatch_f_list, total_f, Pos_Find_Rel, Disease, Disease_CUI, Disease_Definition, all_dz_findings, all_dz_CUIs, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, All_Find_Rel, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence

    // Get list of relationships to unmatched findings
    WITH [x IN All_Find_Rel WHERE NOT x IN Pos_Find_Rel] AS Unmatch_Find_Rel, Pos_Find_Rel, Disease, Disease_CUI, Disease_Definition, all_dz_findings, all_dz_CUIs, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, unmatch_f_list, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence

    UNWIND unmatch_f_list as unmatch_f

    // Get list of unmatched findings
    WITH COLLECT(unmatch_f.name) AS Unmatched_findings, COLLECT(COALESCE(unmatch_f.hpo_id, 'Null')) AS Unmatched_Find_HPO_IDs, collect(DISTINCT(unmatch_f.number_assoc_rare_diseases)) AS Unmatched_Find_number_assoc_rare_diseases, Unmatch_Find_Rel, Pos_Find_Rel, Disease, Disease_CUI, Disease_Definition, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence

    UNWIND Pos_Find_Rel as Pos_Find_Rel_List

    UNWIND
      CASE
        WHEN Unmatch_Find_Rel = [] THEN [null]
        ELSE Unmatch_Find_Rel
      END AS Unmatch_Find_Rel_List

    // Collect a list of unmatched finding frequencies for each disease, changing null to 0 when no relationships to unmatched findings exist
    WITH Disease, Disease_CUI, Disease_Definition, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, Unmatched_findings, Unmatched_Find_HPO_IDs, Unmatched_Find_number_assoc_rare_diseases, Pos_Find_Rel_List, collect(COALESCE(toFloat(Unmatch_Find_Rel_List.approx_frequency), 0)) AS Unmatched_Find_Freqs, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence

    // Calculate the sum of approximate frequency values for all positive findings for each disease
    WITH Disease, Disease_CUI, Disease_Definition, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, Unmatched_findings, Unmatched_Find_HPO_IDs, Unmatched_Find_number_assoc_rare_diseases, sum(toFloat(Pos_Find_Rel_List.approx_frequency)) AS Sum_Pos_Find_Freq, Pos_Find_Rel_List.evidence AS Disease_Finding_Assoc_Evidence, collect(COALESCE(toFloat(Pos_Find_Rel_List.approx_frequency), 0)) AS Pos_Find_Freqs, Unmatched_Find_Freqs, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence

    // Multiply the disease prevalence by the difference between the sum of frequencies of positive and negative findings
    RETURN Disease, Disease_CUI, Disease_Definition, Disease_Finding_Assoc_Evidence, Disease_Point_Prevalence, Disease_Birth_Prevalence, Disease_Lifetime_Prevalence, Disease_Annual_Incidence, Positive_Findings, Pos_Find_HPO_IDs, Pos_Find_number_assoc_rare_diseases, Pos_Find_Freqs, Unmatched_findings, Unmatched_Find_HPO_IDs, Unmatched_Find_number_assoc_rare_diseases, Unmatched_Find_Freqs
    '''.format(Matched_Findings = Matched_Findings)
    data = session.run(query)
    mostLikelyRareDiseases = pd.DataFrame([dict(record) for record in data])
    
    # Find the max prevalence/incidence value
    mostLikelyRareDiseases['Max_Prevalence_or_Incidence'] = mostLikelyRareDiseases[['Disease_Point_Prevalence', 'Disease_Birth_Prevalence', 'Disease_Lifetime_Prevalence', 'Disease_Annual_Incidence']].max(axis=1)
    
    # Transform the evidence column into URLs whenever the evidence comes from PubMed
    mostLikelyRareDiseases['Disease_Finding_Assoc_Evidence'] = mostLikelyRareDiseases['Disease_Finding_Assoc_Evidence'].str.split('_')
    evidence_column = []
    Matched_Findings_Column = []
    Neg_Matched_Findings_Column = []
    Unmatched_Findings_Column = []
    Disease_Probability_Column = []
    Obligatory_Findings_Flag_Column = []
    
    for row in mostLikelyRareDiseases.iterrows():
        
        # Convert PMIDs into links to their respective PubMed articles
        evidence_urls = []
        evidence = row[1]['Disease_Finding_Assoc_Evidence']
        if evidence is not None:
            for item in evidence:
                publication = item.split(':')
                if publication[0] == 'PMID':
                    url = 'https://pubmed.ncbi.nlm.nih.gov/'+publication[1]
                    evidence_urls.append(url)
                else:
                    evidence_urls.append(item)
            evidence_column.append(evidence_urls)
        else:
            evidence_column.append(None)
            
        # Combine the matched findings for each disease into a list of dictionaries
        Matched_Name_List = row[1]["Positive_Findings"]
        Matched_Frequency_List = row[1]["Pos_Find_Freqs"]
        Matched_HPO_ID_List = row[1]["Pos_Find_HPO_IDs"]
        Matched_dict_list = []
        Pos_freq_sum_list = []
        for index, Name in enumerate(Matched_Name_List):
            Matched_dict = {}
            Matched_dict['Name'] = Name
            Matched_dict['Frequency'] = Matched_Frequency_List[index]
            Matched_dict['HPO_ID'] = Matched_HPO_ID_List[index]
            Matched_dict_list.append(Matched_dict)
            Pos_freq_sum_list.append(Matched_Frequency_List[index])

        Matched_Findings_Column.append(Matched_dict_list)
        
        # Combine the unmatched findings for each disease into a list of dictionaries
        Unmatched_Name_List = row[1]["Unmatched_findings"]
        Unmatched_Frequency_List = row[1]["Unmatched_Find_Freqs"]
        Unmatched_HPO_ID_List = row[1]["Unmatched_Find_HPO_IDs"]
        Unmatched_dict_list = []
        Neg_Matched_dict_list = []
        Neg_freq_sum_list = []
        for index, Name in enumerate(Unmatched_Name_List):
            Unmatched_dict = {}
            Unmatched_dict['Name'] = Name
            Unmatched_dict['Frequency'] = Unmatched_Frequency_List[index]
            Unmatched_dict['HPO_ID'] = Unmatched_HPO_ID_List[index]
            if Unmatched_HPO_ID_List[index] in Negative_Matched_Findings:
                Neg_Matched_dict_list.append(Unmatched_dict)
                Neg_freq_sum_list.append(Unmatched_Frequency_List[index])
            else:
                Unmatched_dict_list.append(Unmatched_dict)
                
        # Identify columns with negatively matched findings which have a frequency of 1 (obligatory findings)
        Obligatory_Findings_Flag_Column.append(1 not in Neg_freq_sum_list)
        
        Unmatched_Findings_Column.append(Unmatched_dict_list)
        Neg_Matched_Findings_Column.append(Neg_Matched_dict_list)
        print(Neg_freq_sum_list)
        Disease_Probability_Column.append(sum(Pos_freq_sum_list) - sum(Neg_freq_sum_list))
            
    mostLikelyRareDiseases['Disease_Probability'] = Disease_Probability_Column    
    mostLikelyRareDiseases['Disease_Finding_Assoc_Evidence'] = evidence_column
    mostLikelyRareDiseases['Matched_Findings'] = Matched_Findings_Column
    mostLikelyRareDiseases['Unmatched_Findings'] = Unmatched_Findings_Column
    mostLikelyRareDiseases['Neg_Matched_Findings'] = Neg_Matched_Findings_Column
    
    # Drop any diseases where negatively matched findings were obligatory
    mostLikelyRareDiseases['No_Obligatory_Findings'] = Obligatory_Findings_Flag_Column 
    mostLikelyRareDiseases = mostLikelyRareDiseases[mostLikelyRareDiseases['No_Obligatory_Findings']]
    
    mostLikelyRareDiseases.drop(inplace=True, columns = ['Positive_Findings', 'Pos_Find_Freqs', 'Pos_Find_HPO_IDs', 'Unmatched_findings', 'Unmatched_Find_Freqs', 'Unmatched_Find_HPO_IDs', 'No_Obligatory_Findings'])
    mostLikelyRareDiseases.sort_values(by=['Disease_Probability', 'Max_Prevalence_or_Incidence'], inplace=True, ascending=[False,False])
    
    return mostLikelyRareDiseases.head(10)

