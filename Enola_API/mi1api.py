from operator import imod
from flask_cors import CORS
from flask import Flask, redirect , url_for, render_template, request, jsonify
from flask.wrappers import Response
from numpy import roots
import fetchData
from flask import request, jsonify, Response
import json
import requests
import pandas as pd
import time

app = Flask(__name__)
CORS(app)
app.config["DEBUG"] = True

@app.route('/', methods=['GET'])
def home():
    return '''<h1>Medical Intelligence One</h1>
<p>API powering the Enola Rare Disease Diagnostic Assistant.</p>'''

@app.route('/api/findingsDefinitions', methods=['GET', 'POST'])
def api_findingsDefinitions():
    HPO_list_json = request.data
    parsed = json.loads(HPO_list_json)
    HPO_list=[]
    for item in parsed['Findings_To_Define']:
        HPO_list.append(item['HPO_ID'])

    apidata = fetchData.findingsDefinitions(HPO_list)

    # Handle empty results
    if(apidata.empty):
        return jsonify([])
    else:
        result = apidata.to_json(orient="records")
        parsed = json.loads(result)
        result_data = jsonify(parsed)
        return result_data


@app.route('/api/autocomplete_rareDz_findings', methods=['GET', 'POST'])
def api_autocomplete_rareDz_findings(): 
    data = request.data
    parsed = json.loads(data)
    startingtext = parsed['startsWith'][0]['startsWith']
    
    apidata = fetchData.autocomplete_rareDz_findings(startingtext)
    result = apidata.to_json(orient="records")
    parsed = json.loads(result)
    result_data = jsonify(parsed)
    return result_data


@app.route('/api/rareDiseaseSearchPosNeg', methods=['GET', 'POST'])
def api_rareDiseaseSearchPosNeg(): 
    pproblem = request.data
    parsed = json.loads(pproblem)
    Matched_Findings=[]
    Negative_Matched_Findings=[]
    for item in parsed['Matched_Findings']:
        Matched_Findings.append(item['HPO_ID'])
    if parsed['Negative_Matched_Findings'] != []:
        for item in parsed['Negative_Matched_Findings']:
            Negative_Matched_Findings.append(item['HPO_ID'])
    
    apidata = fetchData.rareDiseaseSearchPosNeg(Matched_Findings, Negative_Matched_Findings)

    # Handle empty results
    if(apidata.empty):
        return jsonify([])
    else:
        result = apidata.to_json(orient="records")
        parsed = json.loads(result) 
        result_data = jsonify(parsed)
        return result_data


if __name__ == '__main__':
    app.debug = True
    app.run(host="44.203.147.253", port=5000) #host="0.0.0.0" will make the page accessable
                            #by going to http://[ip]:5000/ on any computer in 
                            #the network.

