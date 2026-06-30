(function (global, $) {
    if (!$) return;

    const pendingRequests = new Map();

    function post(options) {
        const requestKey = options.key || options.url;
        const previousRequest = pendingRequests.get(requestKey);
        if (previousRequest) previousRequest.abort();

        let retriesRemaining = Number.isInteger(options.retries) ? options.retries : 1;
        let request;

        const finish = () => {
            if (pendingRequests.get(requestKey) === request) {
                pendingRequests.delete(requestKey);
                $('.Loading').fadeOut(0);
            }
        };

        const send = () => {
            $('.Loading').fadeIn(0);
            request = $.ajax({
                type: 'POST',
                url: options.url,
                data: options.data,
                dataType: 'json',
                timeout: options.timeout || 10000,
            });
            pendingRequests.set(requestKey, request);

            request.done((response) => {
                if (pendingRequests.get(requestKey) !== request) return;
                if (typeof options.success === 'function') options.success(response || {});
                finish();
            });

            request.fail((xhr, status) => {
                if (status === 'abort' || pendingRequests.get(requestKey) !== request) return;
                if (retriesRemaining > 0) {
                    retriesRemaining -= 1;
                    setTimeout(send, 400);
                    return;
                }
                if (typeof options.error === 'function') options.error(xhr, status);
                finish();
            });

            return request;
        };

        return send();
    }

    $.ajaxPrefilter((options) => {
        if (/Get(?:My|Noaverage)EmerdList/.test(options.url || '') && !options.timeout) {
            options.timeout = 10000;
        }
    });

    $(document).ajaxError((event, xhr, settings, error) => {
        if (/Get(?:My|Noaverage)EmerdList/.test(settings.url || '') && error !== 'abort') {
            $('.Loading').fadeOut(0);
        }
    });

    global.GameHistoryClient = { post };
})(window, window.jQuery);
