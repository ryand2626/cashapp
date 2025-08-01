/** @cashapp-module **/

import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { useEffect } from "@cashapp/owl";

export class AutoCompleteWithPages extends AutoComplete {
    static props = {
        ...AutoComplete.props,
        targetDropdown: { type: HTMLElement },
        dropdownClass: { type: String, optional: true },
        dropdownOptions: { type: Object, optional: true },
    };
    static template = "website.AutoCompleteWithPages";

    setup() {
        super.setup();
        useEffect(
            (input, inputRef) => {
                if (inputRef) {
                    inputRef.value = input.value;
                }
                const targetBlur = this.onInputBlur.bind(this);
                const targetClick = this._syncInputClick.bind(this);
                const targetChange = this.onInputChange.bind(this);
                const targetInput = this._syncInputValue.bind(this);
                const targetKeydown = this.onInputKeydown.bind(this);
                const targetFocus = this.onInputFocus.bind(this);
                input.addEventListener("blur", targetBlur);
                input.addEventListener("click", targetClick);
                input.addEventListener("change", targetChange);
                input.addEventListener("input", targetInput);
                input.addEventListener("keydown", targetKeydown);
                input.addEventListener("focus", targetFocus);
                return () => {
                    input.removeEventListener("blur", targetBlur);
                    input.removeEventListener("click", targetClick);
                    input.removeEventListener("change", targetChange);
                    input.removeEventListener("input", targetInput);
                    input.removeEventListener("keydown", targetKeydown);
                    input.removeEventListener("focus", targetFocus);
                };
            },
            () => [this.targetDropdown, this.inputRef.el]
        );
    }

    get dropdownOptions() {
        if (this.props.dropdownOptions) {
            return {
                ...super.dropdownOptions,
                ...this.props.dropdownOptions,
            };
        }
        return super.dropdownOptions;
    }

    get ulDropdownClass() {
        let classList = super.ulDropdownClass;
        if (this.props.dropdownClass) {
            classList += ` ${this.props.dropdownClass}`;
        }
        return classList;
    }

    get targetDropdown() {
        return this.props.targetDropdown;
    }

    _syncInputClick(ev) {
        ev.stopPropagation();
        this.onInputClick(ev);
    }

    async _syncInputValue() {
        if (this.inputRef.el) {
            this.inputRef.el.value = this.targetDropdown.value;
            this.onInput();
        }
    }

    /**
     *
     * @param option
     * @return {boolean}
     * @private
     */
    _isCategory(option) {
        return !!option?.separator;
    }

    getOption(indices) {
        const [sourceIndex, optionIndex] = indices;
        return this.sources[sourceIndex]?.options[optionIndex];
    }

    /**
     * @override
     */
    onOptionMouseEnter(indices) {
        if (!this._isCategory(this.getOption(indices))) {
            return super.onOptionMouseEnter(...arguments);
        }
    }

    /**
     * @override
     */
    onOptionMouseLeave(indices) {
        if (!this._isCategory(this.getOption(indices))) {
            return super.onOptionMouseLeave(...arguments);
        }
    }
    isActiveSourceOption(indices) {
        if (!this._isCategory(this.getOption(indices))) {
            return super.isActiveSourceOption(...arguments);
        }
    }
    /**
     * @override
     */
    selectOption(option) {
        if (!this._isCategory(option)) {
            const { value } = Object.getPrototypeOf(option);
            this.targetDropdown.value = value;
            return super.selectOption(...arguments);
        }
    }

    /**
     * @override
     */
    navigate(direction) {
        super.navigate(direction);
        if (direction !== 0 && this.state.activeSourceOption) {
            let [sourceIndex, optionIndex] = this.state.activeSourceOption;
            const option = this.sources[sourceIndex]?.options[optionIndex];
            if (option) {
                if (!!option.separator) {
                    this.navigate(direction);
                }
                const suggestion = Object.getPrototypeOf(option);
                if (suggestion && suggestion.value) {
                    this.inputRef.el.value = suggestion.value;
                }
            }
        }
    }

    /**
     * @override
     */
    onInputFocus(ev) {
        this.targetDropdown.setSelectionRange(0, this.targetDropdown.value.length);
        this.props.onFocus(ev);
    }
}
