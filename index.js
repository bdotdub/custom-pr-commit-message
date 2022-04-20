const core = require('@actions/core');
const github = require('@actions/github');
const Mustache = require('mustache');

async function run() {
    const githubToken = core.getInput('repo-token ', { required: true });
    const octokit = core.getOctokit(githubToken);

    console.log("Fetching pull request");

    const { data: pullRequest } = await octokit.pulls.get({
        owner: github.context.repository.owner.login,
        repo: github.context.repository.name,
        pull_number: github.context.issue.number,
    });
    console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

    const template = `{{{url}}}

{{body}}`;

    const output = Mustache.render(template, pullRequest);
    console.log("Rendered template", output);

    console.log("About to merge")

    await octokit.pulls.merge({
        owner: github.context.repository.owner.login,
        repo: github.context.repository.name,
        pull_number: github.context.issue.number,
        commit_message: output,
        merge_method: 'squash',
    });
}

try {
    run()
} catch (error) {
    setFailed(error.message);
}