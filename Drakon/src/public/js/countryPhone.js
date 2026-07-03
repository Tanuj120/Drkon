(function () {
  const countries = [
    ["+1", "United States"],
    ["+1", "Canada"],
    ["+7", "Russia"],
    ["+20", "Egypt"],
    ["+27", "South Africa"],
    ["+30", "Greece"],
    ["+31", "Netherlands"],
    ["+32", "Belgium"],
    ["+33", "France"],
    ["+34", "Spain"],
    ["+36", "Hungary"],
    ["+39", "Italy"],
    ["+40", "Romania"],
    ["+41", "Switzerland"],
    ["+43", "Austria"],
    ["+44", "United Kingdom"],
    ["+45", "Denmark"],
    ["+46", "Sweden"],
    ["+47", "Norway"],
    ["+48", "Poland"],
    ["+49", "Germany"],
    ["+51", "Peru"],
    ["+52", "Mexico"],
    ["+53", "Cuba"],
    ["+54", "Argentina"],
    ["+55", "Brazil"],
    ["+56", "Chile"],
    ["+57", "Colombia"],
    ["+58", "Venezuela"],
    ["+60", "Malaysia"],
    ["+61", "Australia"],
    ["+62", "Indonesia"],
    ["+63", "Philippines"],
    ["+64", "New Zealand"],
    ["+65", "Singapore"],
    ["+66", "Thailand"],
    ["+81", "Japan"],
    ["+82", "South Korea"],
    ["+84", "Vietnam"],
    ["+86", "China"],
    ["+90", "Turkey"],
    ["+91", "India"],
    ["+92", "Pakistan"],
    ["+93", "Afghanistan"],
    ["+94", "Sri Lanka"],
    ["+95", "Myanmar"],
    ["+98", "Iran"],
    ["+211", "South Sudan"],
    ["+212", "Morocco"],
    ["+213", "Algeria"],
    ["+216", "Tunisia"],
    ["+218", "Libya"],
    ["+220", "Gambia"],
    ["+221", "Senegal"],
    ["+222", "Mauritania"],
    ["+223", "Mali"],
    ["+224", "Guinea"],
    ["+225", "Ivory Coast"],
    ["+226", "Burkina Faso"],
    ["+227", "Niger"],
    ["+228", "Togo"],
    ["+229", "Benin"],
    ["+230", "Mauritius"],
    ["+231", "Liberia"],
    ["+232", "Sierra Leone"],
    ["+233", "Ghana"],
    ["+234", "Nigeria"],
    ["+235", "Chad"],
    ["+236", "Central African Republic"],
    ["+237", "Cameroon"],
    ["+238", "Cape Verde"],
    ["+239", "Sao Tome and Principe"],
    ["+240", "Equatorial Guinea"],
    ["+241", "Gabon"],
    ["+242", "Republic of the Congo"],
    ["+243", "DR Congo"],
    ["+244", "Angola"],
    ["+245", "Guinea-Bissau"],
    ["+246", "British Indian Ocean Territory"],
    ["+248", "Seychelles"],
    ["+249", "Sudan"],
    ["+250", "Rwanda"],
    ["+251", "Ethiopia"],
    ["+252", "Somalia"],
    ["+253", "Djibouti"],
    ["+254", "Kenya"],
    ["+255", "Tanzania"],
    ["+256", "Uganda"],
    ["+257", "Burundi"],
    ["+258", "Mozambique"],
    ["+260", "Zambia"],
    ["+261", "Madagascar"],
    ["+262", "Reunion"],
    ["+263", "Zimbabwe"],
    ["+264", "Namibia"],
    ["+265", "Malawi"],
    ["+266", "Lesotho"],
    ["+267", "Botswana"],
    ["+268", "Eswatini"],
    ["+269", "Comoros"],
    ["+290", "Saint Helena"],
    ["+291", "Eritrea"],
    ["+297", "Aruba"],
    ["+298", "Faroe Islands"],
    ["+299", "Greenland"],
    ["+350", "Gibraltar"],
    ["+351", "Portugal"],
    ["+352", "Luxembourg"],
    ["+353", "Ireland"],
    ["+354", "Iceland"],
    ["+355", "Albania"],
    ["+356", "Malta"],
    ["+357", "Cyprus"],
    ["+358", "Finland"],
    ["+359", "Bulgaria"],
    ["+370", "Lithuania"],
    ["+371", "Latvia"],
    ["+372", "Estonia"],
    ["+373", "Moldova"],
    ["+374", "Armenia"],
    ["+375", "Belarus"],
    ["+376", "Andorra"],
    ["+377", "Monaco"],
    ["+378", "San Marino"],
    ["+380", "Ukraine"],
    ["+381", "Serbia"],
    ["+382", "Montenegro"],
    ["+383", "Kosovo"],
    ["+385", "Croatia"],
    ["+386", "Slovenia"],
    ["+387", "Bosnia and Herzegovina"],
    ["+389", "North Macedonia"],
    ["+420", "Czech Republic"],
    ["+421", "Slovakia"],
    ["+423", "Liechtenstein"],
    ["+500", "Falkland Islands"],
    ["+501", "Belize"],
    ["+502", "Guatemala"],
    ["+503", "El Salvador"],
    ["+504", "Honduras"],
    ["+505", "Nicaragua"],
    ["+506", "Costa Rica"],
    ["+507", "Panama"],
    ["+508", "Saint Pierre and Miquelon"],
    ["+509", "Haiti"],
    ["+590", "Guadeloupe"],
    ["+591", "Bolivia"],
    ["+592", "Guyana"],
    ["+593", "Ecuador"],
    ["+594", "French Guiana"],
    ["+595", "Paraguay"],
    ["+596", "Martinique"],
    ["+597", "Suriname"],
    ["+598", "Uruguay"],
    ["+599", "Curacao"],
    ["+670", "Timor-Leste"],
    ["+672", "Norfolk Island"],
    ["+673", "Brunei"],
    ["+674", "Nauru"],
    ["+675", "Papua New Guinea"],
    ["+676", "Tonga"],
    ["+677", "Solomon Islands"],
    ["+678", "Vanuatu"],
    ["+679", "Fiji"],
    ["+680", "Palau"],
    ["+681", "Wallis and Futuna"],
    ["+682", "Cook Islands"],
    ["+683", "Niue"],
    ["+685", "Samoa"],
    ["+686", "Kiribati"],
    ["+687", "New Caledonia"],
    ["+688", "Tuvalu"],
    ["+689", "French Polynesia"],
    ["+690", "Tokelau"],
    ["+691", "Micronesia"],
    ["+692", "Marshall Islands"],
    ["+850", "North Korea"],
    ["+852", "Hong Kong"],
    ["+853", "Macau"],
    ["+855", "Cambodia"],
    ["+856", "Laos"],
    ["+880", "Bangladesh"],
    ["+886", "Taiwan"],
    ["+960", "Maldives"],
    ["+961", "Lebanon"],
    ["+962", "Jordan"],
    ["+963", "Syria"],
    ["+964", "Iraq"],
    ["+965", "Kuwait"],
    ["+966", "Saudi Arabia"],
    ["+967", "Yemen"],
    ["+968", "Oman"],
    ["+970", "Palestine"],
    ["+971", "United Arab Emirates"],
    ["+972", "Israel"],
    ["+973", "Bahrain"],
    ["+974", "Qatar"],
    ["+975", "Bhutan"],
    ["+976", "Mongolia"],
    ["+977", "Nepal"],
    ["+992", "Tajikistan"],
    ["+993", "Turkmenistan"],
    ["+994", "Azerbaijan"],
    ["+995", "Georgia"],
    ["+996", "Kyrgyzstan"],
    ["+998", "Uzbekistan"],
  ];

  function ensureStyles() {
    if (document.getElementById("country-phone-styles")) return;

    const style = document.createElement("style");
    style.id = "country-phone-styles";
    style.textContent = `
      .phoneInput__container-input {
        display: flex;
        align-items: center;
        gap: .16rem;
        width: 100%;
      }

      .phoneInput__container {
        width: 100%;
      }

      .country-code-field {
        position: relative;
        display: flex;
        align-items: center;
        flex: 0 0 2.55rem;
        min-width: 2.55rem;
        max-width: 2.55rem;
        height: .96rem;
        padding: 0 .18rem 0 0;
        border-right: 1px solid rgba(217, 172, 79, .35);
      }

      .country-code-label {
        display: block;
        width: 100%;
        color: #d9ac4f;
        font-size: .34rem;
        line-height: .96rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
      }

      .country-code-select {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        border: none;
        background: transparent;
        outline: none;
        appearance: none;
      }

      .country-code-select option {
        color: #111;
      }

      .phoneInput__container-input .dropdown {
        display: none !important;
      }

      .phoneInput__container-input input[name="username"],
      .phoneInput__container-input #username {
        display: block !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 .24rem !important;
        text-align: left !important;
        border: none !important;
        box-sizing: border-box !important;
      }

      .phoneInput__container-input input[name="username"]::placeholder,
      .phoneInput__container-input #username::placeholder {
        text-align: left !important;
      }
    `;
    document.head.appendChild(style);
  }

  function buildSelectMarkup() {
    return countries
      .map(function (entry) {
        const code = entry[0];
        const name = entry[1];
        const selected = code === "+1" && name === "United States" ? " selected" : "";
        return '<option value="' + code + '"' + selected + ">" + code + " " + name + "</option>";
      })
      .join("");
  }

  function replaceDropdown(dropdown) {
    if (!dropdown || dropdown.parentElement.querySelector(".country-code-select")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "country-code-field";

    const label = document.createElement("span");
    label.className = "country-code-label";

    const select = document.createElement("select");
    select.className = "country-code-select";
    select.name = "countryCode";
    select.setAttribute("aria-label", "Country code");
    select.innerHTML = buildSelectMarkup();
    label.textContent = select.options[select.selectedIndex].textContent;

    select.addEventListener("change", function () {
      const selectedOption = select.options[select.selectedIndex];
      label.textContent = selectedOption ? selectedOption.textContent : "+1 United States";
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    dropdown.parentElement.insertBefore(wrapper, dropdown);
    dropdown.style.display = "none";
  }

  function init() {
    ensureStyles();
    document.querySelectorAll(".phoneInput__container-input .dropdown").forEach(replaceDropdown);
  }

  window.buildInternationalPhone = function (phoneInput) {
    const select = document.querySelector(".phoneInput__container-input .country-code-select");
    const code = (select && select.value) || "+1";
    const countryDigits = code.replace(/\D/g, "");
    const phoneDigits = String(phoneInput || "").replace(/\D/g, "");

    if (!phoneDigits) return "";
    if (phoneDigits.startsWith(countryDigits)) return phoneDigits;

    return countryDigits + phoneDigits.replace(/^0+/, "");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
