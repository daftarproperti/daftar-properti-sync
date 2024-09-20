import fetch from 'node-fetch';

export async function handleErr(
    error: Error,
    context: { blockNumber: number; offChainLink: string },
    errorHandling: any
): Promise<void> {
    if (errorHandling.errorHandler) {
        await errorHandling.errorHandler(error, context);
        return;
    }

    switch (errorHandling.errorChannel) {
        case 'SLACK':
            if (!errorHandling.slackConfiguration.slackWebhookURL) {
                console.error('Slack webhook URL not configured');
                return;
            }

            const payload = {
                blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Error Notification* :rotating_light:`
                    }
                },
                {
                    type: 'divider'
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Error:*\n\`\`\`${error.message}\`\`\``
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Block Number:*\n${context.blockNumber}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*OffChain Link:*\n${context.offChainLink}`
                        }
                    ]
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Stack Trace:*\n\`\`\`${error.stack}\`\`\``
                    }
                }
                ]
            };

            try {
                await fetch(errorHandling.slackConfiguration.slackWebhookURL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } catch (slackError) {
                console.error('Error sending notification to Slack:', slackError);
            }
            break;

        default:
            console.log(`Unretriable error occurred. context: ${context}. error: ${error}`);
    }
}
