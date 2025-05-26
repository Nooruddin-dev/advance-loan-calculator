import axios from 'axios';


const OPENAI_API_KEY = "test_test";


export const generateAIReport = async (schedule) => {

    //--For the time being, just return some dummy text. If have actual open api key, then remove below line
    const dummySummary = `
1. Summary of total principal, interest, and penalty:

- Total Principal: The total principal is the sum of all the principal payments, which equals $1,073,884.24.
- Total Interest: The total interest is the sum of all the interest payments, which equals $53,214.37.
- Total Penalty: The total penalty is the sum of all the penalties, which equals $53,450.22.
- Total Amount Due: The total amount due, which is the sum of all the amounts due for each installment, equals $1,180,548.83.

2. Identify any patterns:

- The principal amount increases with each installment, which suggests that the loan is being paid off in an increasing principal method.
- The interest amount decreases with each installment. This is typical for a loan as the interest is calculated on the remaining balance, which decreases over time.
- There are penalties applied in the 6th and 9th installments. It can be inferred that these penalties might be due to late payments or other violations of loan terms.

3. Provide tips to optimize repayment:

- As the principal amount is increasing with each installment, it means more of the payment is going towards paying off the loan, reducing the amount of interest paid over time. This is a good repayment strategy.
- However, there have been penalties on the 6th and 9th installments. To avoid these, ensure payments are made on time and all loan terms are adhered to.
- If possible, consider making extra payments to reduce the principal faster. This will also reduce the total amount of interest paid.
- Review the loan agreement for any potential opportunities for renegotiation or refinancing in order to secure a lower interest rate or better repayment terms.
`;

    return dummySummary;

    const scheduleText = schedule.map(row =>
        `Installment ${row.id}: Due ${row.dueDate}, Principal ${row.principal}, Interest ${row.interest}, Penalty ${row.penalty}, Amount Due ${row.amountDue}`
    ).join('\n');

    const prompt = `
You are a financial advisor. Given the following loan repayment schedule, generate:
1. Summary of total principal, interest, and penalty.
2. Identify any patterns.
3. Provide tips to optimize repayment.

Schedule:
${scheduleText}
    `;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4", // Or "gpt-3.5-turbo"
                messages: [
                    { role: "system", content: "You are a financial advisor." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 700
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("OpenAI API error:", err);
        return "❌ Error generating AI report.";
    }
};