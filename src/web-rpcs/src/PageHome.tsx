import { RPC_ENDPOINTS, RpcTestResult, measureRpcLatency } from "@polymedia/suitcase-core";
import React, { useState } from "react";

export const PageHome: React.FC = () =>
{
    /* State */

    const network = "mainnet";
    const [ rpcs, setRpcs ] = useState<RpcUrl[]>(
        RPC_ENDPOINTS[network].map(url => ( { url, enabled: true } ))
    );
    const [ results, setResults ] = useState<RpcTestResult[]>([]);
    const [ isRunning, setIsRunning ] = useState<boolean>(false);

    /* Functions */

    const runTest = async () => {
        setIsRunning(true);
        const newResults = await measureRpcLatency({
            endpoints: rpcs.filter(rpc => rpc.enabled).map(rpc => rpc.url),
        });
        newResults.sort((a, b) => (a.latency ?? 99999) - (b.latency ?? 99999));
        setResults(newResults);
        setIsRunning(false);
    };

    const onRpcCheckboxChange = (url: string) => {
        setRpcs(prevRpcs =>
            prevRpcs.map(rpc =>
                rpc.url !== url ? rpc : { ...rpc, enabled: !rpc.enabled }
            )
        );
    };

    /* HTML */

    return <>

    <h1><span className="rainbow">Sui RPC test</span></h1>

    <div className="section">
        <h2><span className="rainbow">RPCs</span></h2>

        <div id="rpc-selector">
        {rpcs.map(rpc => (
            <div key={rpc.url} className="rpc">
            <label>
                <input
                    type="checkbox"
                    checked={rpc.enabled}
                    onChange={() => onRpcCheckboxChange(rpc.url)}
                />
                {rpc.url}
            </label>
            </div>
        ))}
        </div>

        <button className="btn" onClick={runTest} disabled={isRunning}>
            {isRunning ? "RUNNING" : "TEST"}
        </button>
    </div>

    {results.length > 0 &&
    <div className="section">

        <h2><span className={`rainbow ${isRunning ? "running" : ""}`}>RESULTS</span></h2>

        <div id="results" className={isRunning ? "running" : ""}>
            {results.map(result =>
                <TestResult result={result} key={result.endpoint} />
            )}
        </div>

    </div>}

    </>;
};

export const TestResult: React.FC<{
    result: RpcTestResult;
}> = ({
    result,
}) => {
    const content = result.latency ? <>
        <span className="endpoint">{result.endpoint}</span>
        <span className="latency">{result.latency}ms</span>
    </> : <>
        <span className="endpoint">{result.endpoint}</span>
        <span className="text-red">Error</span>
    </>;
    return <div className="result">
        {content}
    </div>;
};


export type RpcUrl = {
    url: string;
    enabled: boolean;
};