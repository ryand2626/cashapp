import { useService } from "@web/core/utils/hooks";

import { useEffect, useRef } from "@cashapp/owl";

export function useTooltip(refName, params) {
    const tooltip = useService("tooltip");
    const ref = useRef(refName);
    useEffect(
        (el) => tooltip.add(el, params),
        () => [ref.el]
    );
}
