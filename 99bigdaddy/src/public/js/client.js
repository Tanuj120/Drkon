let getWBody = $('.navbar').width();
$(".list-banner .van-swipe-item").css("width", `${getWBody}px`);

let checkWidth = $('.navbar').width();
$('html').css('font-size', `${checkWidth / 10}px`);
$('.van-tabbar .van-tabbar-item').css({
    'transform': 'scale(0.9)',
});
$(window).resize(() => {
    let checkWidth = $('.navbar').width();
    $('html').css('font-size', `${checkWidth / 10}px`);
    $('.van-tabbar .van-tabbar-item').css({
        'transform': 'scale(0.9)',
    });
});

function formatMoney(money, type) {
    return String(money).replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${type}`);
}

const internationalDialCodes = "1,7,20,27,30,31,32,33,34,36,39,40,41,43,44,45,46,47,48,49,51,52,53,54,55,56,57,58,60,61,62,63,64,65,66,81,82,84,86,90,91,92,93,94,95,98,211,212,213,216,218,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,248,249,250,251,252,253,254,255,256,257,258,260,261,262,263,264,265,266,267,268,269,290,291,297,298,299,350,351,352,353,354,355,356,357,358,359,370,371,372,373,374,375,376,377,378,380,381,382,383,385,386,387,389,420,421,423,500,501,502,503,504,505,506,507,508,509,590,591,592,593,594,595,596,597,598,599,670,672,673,674,675,676,677,678,679,680,681,682,683,685,686,687,688,689,690,691,692,850,852,853,855,856,880,886,960,961,962,963,964,965,966,967,968,970,971,972,973,974,975,976,977,992,993,994,995,996,998"
    .split(",")
    .sort((a, b) => b.length - a.length);

function splitInternationalPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    if (!digits) {
        return { code: "", national: "" };
    }

    if (digits.length <= 10) {
        return { code: "91", national: digits };
    }

    const code = internationalDialCodes.find((dialCode) => {
        const national = digits.slice(dialCode.length);
        return digits.startsWith(dialCode) && national.length >= 6;
    }) || "";

    return {
        code: code || "91",
        national: code ? digits.slice(code.length) : digits,
    };
}

function maskPhoneNumber(phone) {
    const parts = splitInternationalPhone(phone);
    const national = parts.national || "";

    if (national.length <= 4) {
        return `+${parts.code} ${national}`.trim();
    }

    const visibleStart = national.slice(0, Math.min(2, national.length - 4));
    return `+${parts.code} ${visibleStart}****${national.slice(-4)}`;
}

function formatDisplayPhone(phone) {
    const parts = splitInternationalPhone(phone);
    return `+${parts.code} ${parts.national}`.trim();
}
