import React, { useEffect, useState } from 'react'
import LoanChart from './LoanChart';
import { generateAIReport } from '../services/ApiCalls';

export default function LoanCalculatorMain() {
    const [activeTab, setActiveTab] = useState("calculator");
    const [assetType, setAssetType] = useState('house_loan');
    const [principal, setPrincipal] = useState(0);
    const [tenure, setTenure] = useState(12);
    const [downPayment, setDownPayment] = useState(0);
    const [applyInterest, setApplyInterest] = useState(true);
    const [interestType, setInterestType] = useState('Reducing');
    const [loanStartDate, setLoanStartDate] = useState(new Date().toISOString().substr(0, 10));

    const [interestControl, setInterestControl] = useState("auto");
    const [manualInterestRate, setManualInterestRate] = useState(8);

    const [includeInsurance, setIncludeInsurance] = useState(false);
    const [insuranceRate, setInsuranceRate] = useState(0.5);

    const [customFees, setCustomFees] = useState([{ name: '', amount: 0 }]);
    const [scenarios, setScenarios] = useState([{ type: 'extra', afterInstallment: 0, count: 0, percent: 0 }]);
    const [schedule, setSchedule] = useState([]);
    const [penalties, setPenalties] = useState([
        { installmentNo: 0, daysLate: 0, ratePercent: 0, applyOn: 'amount' } // or 'amountWithInterest'
    ]);

    const [aiReport, setAIReport] = useState("");
    const [loadingAI, setLoadingAI] = useState(false);


    const getAnnualRate = (months) => {
        if (!applyInterest) return 0;
        if (interestControl === "manual") return manualInterestRate;
        if (months <= 12) return 5;
        if (months <= 60) return 8;
        return 10;
    };

    const calculateSchedule = () => {
        const P = principal - downPayment;
        const n = tenure;
        const annualRateDecimal = getAnnualRate(n) / 100;
        const monthlyRate = annualRateDecimal / 12;

        const EMI = monthlyRate === 0
            ? P / n
            : (P * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);

        const originalEMI = EMI;
        let balance = P;
        const rows = [];

        for (let i = 1; i <= n; i++) {
            if (balance <= 0) break;

            let interestAmt = interestType === 'Reducing'
                ? balance * monthlyRate
                : P * monthlyRate;

            let principalAmt = EMI - interestAmt;
            let extraEmi = null;
            let scenarioNote = '';
            let penaltyAmt = 0;
            let penaltyNote = '';

            let insuranceAmt = includeInsurance ? (balance * (insuranceRate / 100) / 12) : 0;
            const feesTotal = i === 1 ? customFees.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0) : 0;
            let amountDue = EMI + insuranceAmt + feesTotal;

            // Handle Extra or Full Prepayment Scenarios
            scenarios.forEach(sc => {
                // Full prepayment
                if (sc.type === 'full' && i === sc.afterInstallment + 1 && balance > 0) {
                    principalAmt = balance;
                    interestAmt = interestType === 'Reducing' ? balance * monthlyRate : P * monthlyRate;
                    amountDue = balance + interestAmt + insuranceAmt;
                    balance = 0;
                    scenarioNote = `Full Prepayment after #${sc.afterInstallment}`;
                }

                // Extra payment
                if (sc.type === 'extra' && i > sc.afterInstallment && i <= sc.afterInstallment + sc.count && balance > 0) {
                    extraEmi = EMI * (1 + sc.percent / 100);
                    const extraPayment = extraEmi - EMI;
                    principalAmt += extraPayment;
                    amountDue = extraEmi + insuranceAmt + (i === 1 ? feesTotal : 0);
                    scenarioNote = `Extra +${sc.percent}% after #${sc.afterInstallment} (Original: ${EMI.toFixed(2)} → New: ${extraEmi.toFixed(2)})`;
                }
            });

            // Cap principalAmt if it exceeds remaining balance
            if (principalAmt > balance) {
                principalAmt = balance;
                interestAmt = EMI - principalAmt;
            }

            // Penalty logic
            const penaltyData = penalties.find(p => p.installmentNo === i);
            if (penaltyData && penaltyData.daysLate > 0 && penaltyData.ratePercent > 0) {
                const base = penaltyData.applyOn === 'amountWithInterest'
                    ? principalAmt + interestAmt
                    : principalAmt;

                penaltyAmt = base * (penaltyData.ratePercent / 100) * penaltyData.daysLate;
                amountDue += penaltyAmt;
                penaltyNote = `Penalty ${penaltyData.ratePercent}%/day × ${penaltyData.daysLate} day(s)`;
            }

            balance -= principalAmt;

            rows.push({
                id: i,
                dueDate: new Date(new Date(loanStartDate).setMonth(new Date(loanStartDate).getMonth() + i)).toLocaleDateString(),
                rate: (annualRateDecimal * 100).toFixed(2),
                principal: principalAmt.toFixed(2),
                interest: interestAmt.toFixed(2),
                insurance: insuranceAmt.toFixed(2),
                fees: feesTotal.toFixed(2),
                amountDue: amountDue.toFixed(2),
                balance: balance < 0.01 ? "0.00" : balance.toFixed(2),
                penaltyDays: penaltyData?.daysLate || 0,
                penalty: penaltyAmt.toFixed(2),
                originalEmi: originalEMI.toFixed(2),
                extraEmi: extraEmi?.toFixed(2) || null,
                scenarioNote: scenarioNote || penaltyNote || '-'
            });
        }

        // Add final row if loan paid early
        if (rows.length < tenure) {
            rows.push({
                id: rows.length + 1,
                dueDate: '-',
                rate: '-',
                principal: '-',
                interest: '-',
                insurance: '-',
                fees: '-',
                amountDue: '-',
                balance: '0.00',
                penaltyDays: '-',
                penalty: '-',
                originalEmi: '-',
                extraEmi: '-',
                scenarioNote: `🎉 Loan closed early in ${rows.length} month(s)`
            });
        }

        setSchedule(rows);
    };



    const handleAddFee = () => setCustomFees([...customFees, { name: '', amount: 0 }]);
    const handleFeeChange = (idx, field, value) => {
        const updated = [...customFees];
        updated[idx][field] = field === 'amount' ? parseFloat(value) : value;
        setCustomFees(updated);
    };

    const handleAddScenario = () => setScenarios([...scenarios, { type: 'extra', afterInstallment: 0, count: 0, percent: 0 }]);
    // const handleScenarioChange = (idx, field, value) => {
    //   debugger
    //   const updated = [...scenarios];
    //   updated[idx][field] = field === 'percent' ? parseFloat(value) : parseInt(value);
    //   setScenarios(updated);
    // };

    const handleScenarioChange = (idx, field, value) => {
        const updated = [...scenarios];

        if (field === 'type') {
            updated[idx].type = value;

            if (value === 'extra') {
                // Ensure extra fields are initialized
                updated[idx] = {
                    type: 'extra',
                    afterInstallment: updated[idx].afterInstallment || 0,
                    count: updated[idx].count || 1,
                    percent: updated[idx].percent || 0
                };
            } else if (value === 'full') {
                // Clean extra-specific fields for full prepayment
                updated[idx] = {
                    type: 'full',
                    afterInstallment: updated[idx].afterInstallment || 0
                };
            }
        } else {
            updated[idx][field] = field === 'percent' ? parseFloat(value) : parseInt(value);
        }

        setScenarios(updated);
    };


    const handlePenaltyChange = (idx, field, value) => {
        const updated = [...penalties];

        if (field === 'ratePercent' || field === 'daysLate') {
            updated[idx][field] = parseFloat(value);
        } else if (field === 'installmentNo') {
            updated[idx][field] = parseInt(value);
        } else {
            // for 'applyOn' or any string field
            updated[idx][field] = value;
        }

        setPenalties(updated);
    };


    useEffect(() => {
        if (activeTab === "ai" && schedule.length > 0 && aiReport === "") {

            setLoadingAI(true);
            generateAIReport(schedule).then(report => {

                setAIReport(report);
                setLoadingAI(false);
            });
        }
    }, [activeTab]);




    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8 font-inter">


            <div className="max-w-6xl mx-auto rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
                <h1 className="main-heading  text-center">
                    <span className="title-gradient">Loan Repayment Forecasting Tool</span>
                </h1>

                <div className="tab-container d-flex justify-content-start gap-3 mb-6">
                    {[
                        { label: "Calculator", key: "calculator" },
                        { label: "Summary", key: "summary" },
                        { label: "AI Report", key: "ai" }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>


                {activeTab === "calculator" && (
                    <>

                        <form onSubmit={e => { e.preventDefault(); calculateSchedule(); }} className="mb-5">
                            {/* Loan & Interest Info */}
                            <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                                <div className="card-header-gradient text-white p-3 text-xl font-semibold rounded">Loan & Interest Information</div>
                                <div className="card-body p-6">
                                    <div className="row g-4"> {/* Using Bootstrap row and gutter */}
                                        <div className="col-md-4">
                                            <label htmlFor="assetType" className="form-label text-sm font-medium text-gray-700 d-block text-start fw-medium mb-1">Asset Type</label>
                                            <select id="assetType" className="form-select select-field" value={assetType} onChange={e => setAssetType(e.target.value)}>
                                                <option value="house_loan">House Loan</option>
                                                <option value="car_loan">Car Loan</option>
                                                <option value="personal_loan">Personal Loan</option>
                                                <option value="equipment_finance">Equipment Finance</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="loanStartDate" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Loan Start Date</label>
                                            <input type="date" id="loanStartDate" className="form-control input-field" value={loanStartDate} onChange={e => setLoanStartDate(e.target.value)} />
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="principal" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Request Amount</label>
                                            <input type="number" id="principal" className="form-control input-field" value={principal} onChange={e => setPrincipal(parseFloat(e.target.value))} />
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="tenure" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Tenure (months)</label>
                                            <input type="number" id="tenure" className="form-control input-field" value={tenure} onChange={e => setTenure(parseInt(e.target.value))} />
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="downPayment" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Down Payment</label>
                                            <input type="number" id="downPayment" className="form-control input-field" value={downPayment} onChange={e => setDownPayment(parseFloat(e.target.value))} />
                                        </div>
                                        <div className="col-md-4 d-flex align-items-center pt-3"> {/* Use d-flex and pt-3 for alignment */}
                                            <div className="form-check">
                                                <input type="checkbox" id="applyInterest" className="form-check-input checkbox-field" checked={applyInterest} onChange={e => setApplyInterest(e.target.checked)} />
                                                <label htmlFor="applyInterest" className="form-check-label text-sm font-medium text-gray-700">Apply Interest</label>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="interestType" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Interest Type</label>
                                            <select id="interestType" className="form-select select-field" value={interestType} onChange={e => setInterestType(e.target.value)}>
                                                <option>Reducing</option>
                                                <option>Fixed</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label htmlFor="interestControl" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Interest Rate Control</label>
                                            <select id="interestControl" className="form-select select-field" value={interestControl} onChange={e => setInterestControl(e.target.value)}>
                                                <option value="auto">Auto by Tenure</option>
                                                <option value="manual">Manual</option>
                                            </select>
                                        </div>
                                        {interestControl === "manual" && (
                                            <div className="col-md-4">
                                                <label htmlFor="manualInterestRate" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Manual Annual Interest Rate (%)</label>
                                                <input type="number" step="0.1" id="manualInterestRate" className="form-control input-field" value={manualInterestRate} onChange={e => setManualInterestRate(parseFloat(e.target.value))} />
                                            </div>
                                        )}
                                        <div className="col-md-4 d-flex align-items-center pt-3"> {/* Use d-flex and pt-3 for alignment */}
                                            <div className="form-check">
                                                <input type="checkbox" id="includeInsurance" className="form-check-input checkbox-field" checked={includeInsurance} onChange={e => setIncludeInsurance(e.target.checked)} />
                                                <label htmlFor="includeInsurance" className="form-check-label text-sm font-medium text-gray-700">Include Loan Insurance</label>
                                            </div>
                                        </div>
                                        {includeInsurance && (
                                            <div className="col-md-4">
                                                <label htmlFor="insuranceRate" className="form-label text-sm font-medium d-block text-start fw-medium text-gray-700 mb-1">Insurance Rate (% annual)</label>
                                                <input type="number" step="0.01" id="insuranceRate" className="form-control input-field" value={insuranceRate} onChange={e => setInsuranceRate(parseFloat(e.target.value))} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Custom Fees */}
                            <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                                <div className="card-header-secondary text-white p-3 text-xl font-semibold rounded">Additional Custom Fees</div>
                                <div className="card-body p-6">
                                    {customFees.map((fee, idx) => (
                                        <div className="row g-4 align-items-end mb-3" key={idx}>
                                            <div className="col-md-6">
                                                <label htmlFor={`feeName-${idx}`} className="form-label d-block text-start fw-medium mb-1">Fee Name</label>
                                                <input type="text" id={`feeName-${idx}`} className="form-control input-field" value={fee.name} onChange={e => handleFeeChange(idx, 'name', e.target.value)} />
                                            </div>
                                            <div className="col-md-6">
                                                <label htmlFor={`feeAmount-${idx}`} className="form-label d-block text-start fw-medium mb-1">Amount</label>
                                                <input type="number" id={`feeAmount-${idx}`} className="form-control input-field" value={fee.amount} onChange={e => handleFeeChange(idx, 'amount', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" className="custom-button custom-button-orange" onClick={handleAddFee}>+ Add Fee</button>


                                </div>
                            </div>

                            {/* Prepayment Scenarios */}
                            <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                                <div className="card-header-info text-white p-3 text-xl font-semibold rounded">Extra / Prepayment Scenarios</div>
                                <div className="card-body p-6">
                                    {scenarios.map((sc, idx) => (
                                        <div className="row g-4 align-items-end mb-3" key={idx}>
                                            <div className="col-md-3">
                                                <label htmlFor={`scenarioType-${idx}`} className="form-label text-gray-700 d-block text-start fw-medium mb-1 ">Type</label>
                                                <select id={`scenarioType-${idx}`} className="form-select select-field" value={sc.type} onChange={e => handleScenarioChange(idx, 'type', e.target.value)}>
                                                    <option value="extra">Extra Payment</option>
                                                    <option value="full">Full Prepayment</option>
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label htmlFor={`afterInstallment-${idx}`} className="form-label text-gray-700 d-block text-start fw-medium mb-1 ">After Installment #</label>
                                                <input type="number" id={`afterInstallment-${idx}`} className="form-control input-field" value={sc.afterInstallment} onChange={e => handleScenarioChange(idx, 'afterInstallment', e.target.value)} />
                                            </div>
                                            {sc.type === 'extra' && (
                                                <>
                                                    <div className="col-md-3">
                                                        <label htmlFor={`count-${idx}`} className="form-label text-gray-700 d-block text-start fw-medium mb-1 ">Count (# installments)</label>
                                                        <input type="number" id={`count-${idx}`} className="form-control input-field" value={sc.count} onChange={e => handleScenarioChange(idx, 'count', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-3">
                                                        <label htmlFor={`percent-${idx}`} className="form-label text-gray-700 d-block text-start fw-medium mb-1 ">Extra %</label>
                                                        <input type="number" step="0.1" id={`percent-${idx}`} className="form-control input-field" value={sc.percent} onChange={e => handleScenarioChange(idx, 'percent', e.target.value)} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    <button type="button" className="custom-button custom-button-cyan" onClick={handleAddScenario}>+ Add Scenario</button>

                                </div>
                            </div>

                            {/* Penalty Section */}
                            <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                                <div className="card-header-danger text-white p-3 text-xl font-semibold rounded">Penalty Section</div>
                                <div className="card-body p-6">
                                    {penalties.map((p, idx) => (
                                        <div className="row g-4 align-items-end mb-3" key={idx}>
                                            <div className="col-md-3">
                                                <label htmlFor={`penaltyInstallmentNo-${idx}`} className="form-label text-sm font-medium text-gray-700 mb-1">Installment No</label>
                                                <input type="number" id={`penaltyInstallmentNo-${idx}`} className="form-control input-field" value={p.installmentNo} onChange={e => handlePenaltyChange(idx, 'installmentNo', e.target.value)} />
                                            </div>
                                            <div className="col-md-3">
                                                <label htmlFor={`daysLate-${idx}`} className="form-label text-sm font-medium text-gray-700 mb-1">Days Late</label>
                                                <input type="number" id={`daysLate-${idx}`} className="form-control input-field" value={p.daysLate} onChange={e => handlePenaltyChange(idx, 'daysLate', e.target.value)} />
                                            </div>
                                            <div className="col-md-3">
                                                <label htmlFor={`ratePercent-${idx}`} className="form-label text-sm font-medium text-gray-700 mb-1">Penalty % (per day)</label>
                                                <input type="number" id={`ratePercent-${idx}`} className="form-control input-field" value={p.ratePercent} onChange={e => handlePenaltyChange(idx, 'ratePercent', e.target.value)} />
                                            </div>
                                            <div className="col-md-3">
                                                <label htmlFor={`applyOn-${idx}`} className="form-label text-sm font-medium text-gray-700 mb-1">Apply On</label>
                                                <select id={`applyOn-${idx}`} className="form-select select-field" value={p.applyOn} onChange={e => handlePenaltyChange(idx, 'applyOn', e.target.value)}>
                                                    <option value="amount">Amount</option>
                                                    <option value="amountWithInterest">Amount + Interest</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" className="custom-button custom-button-red" onClick={() => setPenalties([...penalties, { installmentNo: 0, daysLate: 0, ratePercent: 0, applyOn: 'amount' }])}>
                                        + Add Penalty
                                    </button>


                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="text-center">
                                <button type="submit" className="btn-primary-gradient w-30 w-sm-auto">
                                    Process Repayment Plan
                                </button>
                            </div>
                        </form>


                        {schedule.length > 0 && (
                            <div className="card mt-5 rounded-xl shadow-lg overflow-hidden">
                                <div className="card-header-dark text-white p-3 text-xl font-semibold rounded">Repayment Schedule</div>
                                <div className="card-body p-6 table-responsive">
                                    <table className="table table-bordered table-striped text-left">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">#</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Due Date</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Rate (%)</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Principal</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Interest</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Insurance</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Fees</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Amount Due</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Balance</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Days Late</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Penalty</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Original EMI</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Adjusted EMI</th>
                                                <th className="py-3 px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">Scenario Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedule.map(row => (
                                                <tr key={row.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.id}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.dueDate}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.rate}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.principal}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.interest}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.insurance}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.fees}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.amountDue}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.balance}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.penaltyDays}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.penalty}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.originalEmi}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.extraEmi || '-'}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 border-b border-gray-200">{row.scenarioNote || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "summary" && (
                    <>

                        <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                            {/* <div className="card-header-gradient text-white p-3 text-xl font-semibold">Loan Summary</div> */}
                            <div className="card-body p-6">
                                <div className="row g-4 text-center mb-5">
                                    <div className="col-md-3">
                                        <div className="summary-card border-primary">
                                            <h6>Total Principal</h6>
                                            <h4>Rs. {(principal - downPayment).toLocaleString()}</h4>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="summary-card border-success">
                                            <h6>Total Interest</h6>
                                            <h4>Rs. {schedule.reduce((sum, r) => sum + parseFloat(r.interest || 0), 0).toFixed(2)}</h4>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="summary-card border-danger">
                                            <h6>Total Penalty</h6>
                                            <h4>Rs. {schedule.reduce((sum, r) => sum + parseFloat(r.penalty || 0), 0).toFixed(2)}</h4>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="summary-card border-info">
                                            <h6>Total Payable</h6>
                                            <h4>Rs. {schedule.reduce((sum, r) => sum + parseFloat(r.amountDue || 0), 0).toFixed(2)}</h4>
                                        </div>
                                    </div>
                                </div>


                                <h3 className="text-xl font-bold mb-3">Repayment Visualization</h3>
                                <LoanChart schedule={schedule} />

                            </div>
                        </div>




                    </>
                )}


                {activeTab === "ai" && (
                    <div className="card rounded-xl shadow-lg mb-4 overflow-hidden">
                        {/* <div className="card-header-gradient text-white p-3 text-xl font-semibold">AI Summary</div> */}
                        <div className="card-body p-6">
                            <div className="row g-4 text-center mb-5">
                                <div className="col-lg-12">
                                    {/* {loadingAI ? (
                                        <div className="text-center p-4">Generating AI report...</div>
                                    ) : (
                                        <div className="bg-light text-dark p-4 rounded shadow-sm">
                                            <h5 className="mb-3">AI Generated Financial Summary:</h5>
                                            <pre className="text-start" style={{ whiteSpace: 'pre-wrap' }}>
                                                {aiReport}
                                            </pre>
                                        </div>
                                    )} */}

                                    {/* comment below one and uncomment above one once implement Actual Open AI */}
                                    <div className="bg-light text-dark p-4 rounded shadow-sm">
                                        <h5 className="mb-3">AI Generated Financial Summary:</h5>
                                        <pre className="text-start" style={{ whiteSpace: 'pre-wrap' }} >
                                            {aiReport}
                                        </pre>
                                    </div>




                                </div>
                            </div>




                        </div>
                    </div>
                )}

            </div>
        </div>

    )
}
